import collections
import contextlib
import functools
import itertools
import time

from hat import util
from hat.drivers import iec104
from hat.manager import common


default_master_conf = {'properties': {'host': '127.0.0.1',
                                      'port': 2404,
                                      'response_timeout': 15,
                                      'supervisory_timeout': 10,
                                      'test_timeout': 20,
                                      'send_window_size': 12,
                                      'receive_window_size': 8}}

default_slave_conf = {'properties': {'host': '127.0.0.1',
                                     'port': 2404,
                                     'response_timeout': 15,
                                     'supervisory_timeout': 10,
                                     'test_timeout': 20,
                                     'send_window_size': 12,
                                     'receive_window_size': 8},
                      'data': [],
                      'commands': []}

master_data_size = 100


class Master(common.Device):

    def __init__(self, conf, logger):
        self._logger = logger
        self._conn = None
        self._data = common.DataStorage({'properties': conf['properties'],
                                         'data': []})

    @property
    def data(self):
        return self._data

    def get_conf(self):
        return {'properties': self._data.data['properties']}

    async def create(self):
        properties = self._data.data['properties']
        self._conn = await iec104.connect(
            addr=iec104.Address(properties['host'],
                                properties['port']),
            response_timeout=properties['response_timeout'],
            supervisory_timeout=properties['supervisory_timeout'],
            test_timeout=properties['test_timeout'],
            send_window_size=properties['send_window_size'],
            receive_window_size=properties['receive_window_size'])
        self._conn.async_group.spawn(self._connection_loop, self._conn)
        return self._conn

    async def execute(self, action, *args):
        if action == 'set_property':
            return self._act_set_property(*args)

        if action == 'interrogate':
            return await self._act_interrogate(*args)

        if action == 'counter_interrogate':
            return await self._act_counter_interrogate(*args)

        if action == 'send_command':
            return await self._act_send_command(*args)

        raise ValueError('invalid action')

    async def _connection_loop(self, conn):
        try:
            while True:
                data = await conn.receive()
                self._logger.log(f'received data changes (count: {len(data)})')
                self._add_data(data)

        except ConnectionError:
            pass

        finally:
            conn.close()

    def _act_set_property(self, path, value):
        self._logger.log(f'changing property {path} to {value}')
        self._data.set(['properties', path], value)

    async def _act_interrogate(self, asdu):
        if not self._conn or not self._conn.is_open:
            self._logger.log('interrogate failed - not connected')
            return

        self._logger.log(f'sending interrogate (asdu: {asdu})')
        data = await self._conn.interrogate(asdu)
        self._logger.log(f'received interrogate result (count: {len(data)})')
        self._add_data(data)

    async def _act_counter_interrogate(self, asdu, freeze):
        if not self._conn or not self._conn.is_open:
            self._logger.log('counter interrogate failed - not connected')
            return

        self._logger.log(f'sending counter interrogate (asdu: {asdu})')
        freeze = iec104.FreezeCode[freeze]
        data = await self._conn.counter_interrogate(asdu, freeze)
        self._logger.log(f'received counter interrogate result '
                         f'(count: {len(data)})')
        self._add_data(data)

    async def _act_send_command(self, cmd):
        if not self._conn or not self._conn.is_open:
            self._logger.log('command failed - not connected')
            return

        self._logger.log('sending command')
        cmd = _cmd_from_json(cmd)
        result = await self._conn.send_command(cmd)
        self._logger.log(f'received command result (success: {result})')
        return result

    def _add_data(self, data):
        if not data:
            return
        now = time.time()
        data = itertools.chain((dict(_data_to_json(i), timestamp=now)
                                for i in reversed(data)),
                               self._data.data['data'])
        data = itertools.islice(data, master_data_size)
        self._data.set('data', list(data))


class Slave(common.Device):

    def __init__(self, conf, logger):
        self._logger = logger
        self._next_data_ids = (str(i) for i in itertools.count(1))
        self._next_command_ids = (str(i) for i in itertools.count(1))
        self._data_notify_cbs = util.CallbackRegistry()
        self._data = common.DataStorage({
            'properties': conf['properties'],
            'connection_count': 0,
            'data': {next(self._next_data_ids): i
                     for i in conf['data']},
            'commands': {next(self._next_command_ids): dict(i, value=None)
                         for i in conf['commands']}})

    @property
    def data(self):
        return self._data

    def get_conf(self):
        return {'properties': self._data.data['properties'],
                'data': list(self._data.data['data'].values()),
                'commands': [{'type': i['type'],
                              'asdu': i['asdu'],
                              'io': i['io'],
                              'success': i['success']}
                             for i in self._data.data['commands'].values()]}

    async def create(self):
        properties = self._data.data['properties']
        srv = await iec104.listen(
            connection_cb=self._connection_loop,
            addr=iec104.Address(properties['host'],
                                properties['port']),
            interrogate_cb=self._on_interrogate,
            counter_interrogate_cb=self._on_counter_interrogate,
            command_cb=self._on_command,
            response_timeout=properties['response_timeout'],
            supervisory_timeout=properties['supervisory_timeout'],
            test_timeout=properties['test_timeout'],
            send_window_size=properties['send_window_size'],
            receive_window_size=properties['receive_window_size'])
        return srv

    async def execute(self, action, *args):
        if action == 'set_property':
            return self._act_set_property(*args)

        if action == 'add_data':
            return self._act_add_data(*args)

        if action == 'remove_data':
            return self._act_remove_data(*args)

        if action == 'change_data':
            return self._act_change_data(*args)

        if action == 'notify_data':
            return self._act_notify_data(*args)

        if action == 'add_command':
            return self._act_add_command(*args)

        if action == 'remove_command':
            return self._act_remove_command(*args)

        if action == 'change_command':
            return self._act_change_command(*args)

        raise ValueError('invalid action')

    async def _connection_loop(self, conn):
        try:
            self._logger.log('new connection accepted')
            self._data.set('connection_count',
                           self._data.data['connection_count'] + 1)
            notify_cb = functools.partial(self._on_data_notify, conn)
            with self._data_notify_cbs.register(notify_cb):
                while True:
                    await conn.receive()

        except ConnectionError:
            pass

        finally:
            conn.close()
            self._logger.log('connection closed')
            self._data.set('connection_count',
                           self._data.data['connection_count'] - 1)

    def _on_interrogate(self, conn, asdu):
        self._logger.log(f'received interrogate request (asdu: {asdu})')
        result = collections.deque()
        for i in self._data.data['data'].values():
            if i['type'] == 'BinaryCounter':
                continue
            if asdu != 0xFFFF and asdu != i['asdu']:
                continue
            with contextlib.suppress(Exception):
                data = _data_from_json(i)
                data = data._replace(cause=iec104.Cause.INTERROGATED_STATION)
                result.append(data)
        return list(result)

    def _on_counter_interrogate(self, conn, asdu, freeze):
        self._logger.log(f'received counter interrogate request '
                         f'(asdu: {asdu})')
        result = collections.deque()
        for i in self._data.data['data'].values():
            if i['type'] != 'BinaryCounter':
                continue
            if asdu != 0xFFFF and asdu != i['asdu']:
                continue
            with contextlib.suppress(Exception):
                data = _data_from_json(i)
                data = data._replace(cause=iec104.Cause.INTERROGATED_COUNTER)
                result.append(data)
        return list(result)

    def _on_command(self, conn, cmds):
        self._logger.log(f'received commands {cmds}')
        success = True
        for cmd in cmds:
            value = _value_to_json(cmd.value)
            key = util.first(value.keys()), cmd.asdu_address, cmd.io_address
            command_id, command = util.first(
                self._data.data['commands'].items(),
                lambda i: (i[1]['type'], i[1]['asdu'], i[1]['io']) == key,
                (None, None))
            cmd_success = bool(command['success']) if command else False
            if cmd_success:
                self._data.set(['commands', command_id, 'value'], value)
            else:
                success = False
        self._logger.log(f'sending commands success {success}')
        return success

    def _on_data_notify(self, conn, data):
        conn.notify_data_change([data])

    def _act_set_property(self, path, value):
        self._logger.log(f'changing property {path} to {value}')
        self._data.set(['properties', path], value)

    def _act_add_data(self):
        self._logger.log('creating new data')
        data_id = next(self._next_data_ids)
        self._data.set(['data', data_id], {
            'type': 'Single',
            'asdu': None,
            'io': None,
            'value': {'Single': 'OFF',
                      'Double': 'OFF',
                      'StepPosition': {'value': 0,
                                       'transient': False},
                      'Bitstring': '00 00 00 00',
                      'Normalized': 0,
                      'Scaled': 0,
                      'Floating': 0,
                      'BinaryCounter': {'value': 0,
                                        'sequence': 0,
                                        'overflow': False,
                                        'adjusted': False,
                                        'invalid': False}},
            'quality': {'invalid': False,
                        'not_topical': False,
                        'substituted': False,
                        'blocked': False,
                        'overflow': False},
            'time': None,
            'cause': 'UNDEFINED',
            'is_test': False})
        return data_id

    def _act_remove_data(self, data_id):
        self._logger.log('removing data')
        self._data.remove(['data', data_id])

    def _act_change_data(self, data_id, path, value):
        self._logger.log(f'changing data {path} to {value}')
        self._data.set(['data', data_id, path], value)

    def _act_notify_data(self, data_id):
        try:
            data = _data_from_json(self._data.data['data'][data_id])
        except Exception:
            return
        self._logger.log('notifying data change')
        self._data_notify_cbs.notify(data)

    def _act_add_command(self):
        self._logger.log('creating new command')
        command_id = next(self._next_command_ids)
        self._data.set(['commands', command_id], {
            'type': 'Single',
            'asdu': None,
            'io': None,
            'value': {'Single': 'OFF',
                      'Double': 'OFF',
                      'Regulating': 'LOWER',
                      'Normalized': 0,
                      'Scaled': 0,
                      'Floating': 0},
            'success': True})
        return command_id

    def _act_remove_command(self, command_id):
        self._logger.log('removing command')
        self._data.remove(['commands', command_id])

    def _act_change_command(self, command_id, path, value):
        self._logger.log(f'changing command {path} to {value}')
        self._data.set(['commands', command_id, path], value)


def _data_to_json(data):
    value = _value_to_json(data.value)
    return {'type': util.first(value.keys()),
            'asdu': data.asdu_address,
            'io': data.io_address,
            'value': value,
            'quality': data.quality._asdict() if data.quality else None,
            'time': data.time._asdict() if data.time else None,
            'cause': data.cause.name,
            'is_test': data.is_test}


def _data_from_json(data):
    if data['asdu'] is None or data['io'] is None:
        raise Exception('undefined asdu/io')

    return iec104.Data(
        value=_value_from_json(data['type'], data['value']),
        quality=iec104.Quality(**data['quality']) if data['quality'] else None,
        time=iec104.Time(**data['time']) if data['time'] else None,
        asdu_address=data['asdu'],
        io_address=data['io'],
        cause=iec104.Cause[data['cause']],
        is_test=data['is_test'])


def _cmd_from_json(cmd):
    if cmd['asdu'] is None or cmd['io'] is None:
        raise Exception('undefined asdu/io')

    return iec104.Command(
        action=iec104.Action[cmd['action']],
        value=_value_from_json(cmd['type'], cmd['value']),
        asdu_address=cmd['asdu'],
        io_address=cmd['io'],
        time=iec104.Time(**cmd['time']) if cmd['time'] else None,
        qualifier=cmd['qualifier'] or 0)


def _value_to_json(value):
    if isinstance(value, iec104.SingleValue):
        return {'Single': value.name}

    if isinstance(value, iec104.DoubleValue):
        return {'Double': value.name}

    if isinstance(value, iec104.RegulatingValue):
        return {'Regulating': value.name}

    if isinstance(value, iec104.StepPositionValue):
        return {'StepPosition': value._asdict()}

    if isinstance(value, iec104.BitstringValue):
        return {'Bitstring': value.value.hex()}

    if isinstance(value, iec104.NormalizedValue):
        return {'Normalized': value.value}

    if isinstance(value, iec104.ScaledValue):
        return {'Scaled': value.value}

    if isinstance(value, iec104.FloatingValue):
        return {'Floating': value.value}

    if isinstance(value, iec104.BinaryCounterValue):
        return {'BinaryCounter': value._asdict()}

    raise ValueError('unsupported value')


def _value_from_json(data_type, value):
    if data_type == 'Single':
        return iec104.SingleValue[value['Single']]

    if data_type == 'Double':
        return iec104.DoubleValue[value['Double']]

    if data_type == 'Regulating':
        return iec104.RegulatingValue[value['Regulating']]

    if data_type == 'StepPosition':
        return iec104.StepPositionValue(**value['StepPosition'])

    if data_type == 'Bitstring':
        return iec104.BitstringValue((bytes.fromhex(value['Bitstring']) +
                                      b'\x00\x00\x00\x00')[:4])

    if data_type == 'Normalized':
        return iec104.NormalizedValue(value['Normalized'])

    if data_type == 'Scaled':
        return iec104.ScaledValue(value['Scaled'])

    if data_type == 'Floating':
        return iec104.FloatingValue(value['Floating'])

    if data_type == 'BinaryCounter':
        return iec104.BinaryCounterValue(**value['BinaryCounter'])

    raise ValueError('unsupported data type')
