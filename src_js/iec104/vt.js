import r from '@hat-open/renderer';
import * as u from '@hat-open/util';

import * as iter from '../iter';
import * as datetime from '../datetime';

import * as common from './common';


const dataTypes = ['Single', 'Double', 'StepPosition',
                   'Bitstring', 'Normalized', 'Scaled', 'Floating',
                   'BinaryCounter'];

const commandTypes = ['Single', 'Double', 'Regulating', 'Normalized',
                      'Scaled', 'Floating'];

const dataCauses = ['UNDEFINED',
                    'PERIODIC',
                    'BACKGROUND_SCAN',
                    'SPONTANEOUS',
                    'INITIALIZED',
                    'REQUEST',
                    'ACTIVATION',
                    'ACTIVATION_CONFIRMATION',
                    'DEACTIVATION',
                    'DEACTIVATION_CONFIRMATION',
                    'ACTIVATION_TERMINATION',
                    'REMOTE_COMMAND',
                    'LOCAL_COMMAND',
                    'FILE_TRANSFER',
                    'INTERROGATED_STATION',
                    'INTERROGATED_GROUP01',
                    'INTERROGATED_GROUP02',
                    'INTERROGATED_GROUP03',
                    'INTERROGATED_GROUP04',
                    'INTERROGATED_GROUP05',
                    'INTERROGATED_GROUP06',
                    'INTERROGATED_GROUP07',
                    'INTERROGATED_GROUP08',
                    'INTERROGATED_GROUP09',
                    'INTERROGATED_GROUP10',
                    'INTERROGATED_GROUP11',
                    'INTERROGATED_GROUP12',
                    'INTERROGATED_GROUP13',
                    'INTERROGATED_GROUP14',
                    'INTERROGATED_GROUP15',
                    'INTERROGATED_GROUP16',
                    'INTERROGATED_COUNTER',
                    'INTERROGATED_COUNTER01',
                    'INTERROGATED_COUNTER02',
                    'INTERROGATED_COUNTER03',
                    'INTERROGATED_COUNTER04',
                    'UNKNOWN_TYPE',
                    'UNKNOWN_CAUSE',
                    'UNKNOWN_ASDU_ADDRESS',
                    'UNKNOWN_IO_ADDRESS'];

const singleValues = ['OFF', 'ON'];

const doubleValues = ['INTERMEDIATE', 'OFF', 'ON', 'FAULT'];

const regulatingValues = ['LOWER', 'HIGHER'];

const commandActions = ['EXECUTE', 'SELECT', 'CANCEL'];

const freezeValues = ['READ', 'FREEZE', 'FREEZE_AND_RESET', 'RESET'];


export function master() {
    const deviceId = r.get('deviceId');

    return ['div.page.iec104.master',
        properties(deviceId),
        masterControl(deviceId),
        masterData(deviceId)
    ];
}


export function slave() {
    const deviceId = r.get('deviceId');

    return ['div.page.iec104.slave',
        properties(deviceId),
        slaveData(deviceId),
        slaveCommands(deviceId),
        slavePanel(deviceId)
    ];
}


function properties(deviceId) {
    const properties = r.get('remote', 'devices', deviceId, 'data', 'properties');

    const onChange = u.curry((property, value) =>
        common.setProperty(deviceId, property, value)
    );

    return ['div.properties',
        formEntryText('Host', properties.host, onChange('host')),
        formEntryNumber('Port', properties.port, onChange('port')),
        formEntryNumber('Response timeout', properties.response_timeout, onChange('response_timeout')),
        formEntryNumber('Supervisory timeout', properties.supervisory_timeout, onChange('supervisory_timeout')),
        formEntryNumber('Test timeout', properties.test_timeout, onChange('test_timeout')),
        formEntryNumber('Send window', properties.send_window_size, onChange('send_window_size')),
        formEntryNumber('Receive window', properties.receive_window_size, onChange('receive_window_size'))
    ];
}


function masterControl(deviceId) {
    const selectedTypePath = ['pages', deviceId, 'control', 'type'];

    const selectedType = r.get(selectedTypePath)  || 'interrogate';

    return ['div.control',
        ['div.header',
            [['interrogate', 'Interrogate'],
             ['counterInterrogate', 'Counter interrogate'],
             ['command', 'Command']
            ].map(([type, label]) => ['div', {
                class: {
                    selected: selectedType == type
                },
                on: {
                    click: _ => r.set(selectedTypePath, type)
                }},
                label
            ])
        ],
        {
            'interrogate': masterControlInterrogate,
            'counterInterrogate': masterControlCounterInterrogate,
            'command': masterControlCommand
        }[selectedType](deviceId)
    ];
}


function masterControlInterrogate(deviceId) {
    const dataPath = ['pages', deviceId, 'control', 'interrogate'];
    const asduPath = [dataPath, 'asdu'];

    const asdu = r.get(asduPath) || 0xFFFF;

    return ['div.content',
        ['div.form',
            formEntryNumber('ASDU', asdu, val => r.set(asduPath, val))
        ],
        ['button', {
            on: {
                click: _ => common.interrogate(deviceId, asdu)
            }},
            'Interrogate'
        ]
    ];
}


function masterControlCounterInterrogate(deviceId) {
    const dataPath = ['pages', deviceId, 'control', 'counterInterrogate'];
    const asduPath = [dataPath, 'asdu'];
    const freezePath = [dataPath, 'freeze'];

    const asdu = r.get(asduPath) || 0xFFFF;
    const freeze = r.get(freezePath) || 'READ';

    return ['div.content',
        ['div.form',
            formEntryNumber('ASDU',
                            asdu,
                            val => r.set(asduPath, val)),
            formEntrySelect('Freeze',
                            freeze,
                            freezeValues,
                            val => r.set(freezePath, val))
        ],
        ['button', {
            on: {
                click: _ => common.counterInterrogate(deviceId, asdu, freeze)
            }},
            'Counter interrogate'
        ]
    ];
}


function masterControlCommand(deviceId) {
    const cmdPath = ['pages', deviceId, 'control', 'command'];

    const cmd = r.get(cmdPath) || {
        type: 'Single',
        asdu: 1,
        io: 1,
        action: 'EXECUTE',
        value: {
            Single: 'OFF',
            Double: 'OFF',
            Regulating: 'LOWER',
            Normalized: 0,
            Scaled: 0,
            Floating: 0
        },
        time: null,
        qualifier: 0
    };

    const onChange = u.curry((property, value) =>
        r.set(cmdPath, u.set(property, value, cmd))
    );

    return ['div.content',
        ['div.form',
            formEntrySelect('Type', cmd.type, commandTypes, onChange('type')),
            formEntryNumber('ASDU', cmd.asdu, onChange('asdu')),
            formEntryNumber('IO', cmd.io, onChange('io')),
            formEntrySelect('Action', cmd.action, commandActions, onChange('action')),
            masterControlCommandValue(deviceId, cmd),
            timeFormEntries(cmd.time, onChange('time')),
            formEntryNumber('Qualifier', cmd.qualifier, onChange('qualifier'))
        ],
        ['button', {
            on: {
                click: _ => common.sendCommand(deviceId, cmd)
            }},
            'Send command'
        ]
    ];
}


function masterControlCommandValue(deviceId, cmd) {
    const cmdPath = ['pages', deviceId, 'control', 'command'];

    const value = cmd.value[cmd.type];

    const onChange = val => r.set(cmdPath, u.set(['value', cmd.type], val, cmd));

    if (cmd.type == 'Single')
        return formEntrySelect('Value', value, singleValues, onChange);

    if (cmd.type == 'Double')
        return formEntrySelect('Value', value, doubleValues, onChange);

    if (cmd.type == 'Regulating')
        return formEntrySelect('Value', value, regulatingValues, onChange);

    return formEntryNumber('Value', value, onChange);
}


function masterData(deviceId) {
    const data = r.get('remote', 'devices', deviceId, 'data', 'data') || [];

    return ['div.data',
        tableData(iter.map(i => [null, i], data), true)
    ];
}


function slaveData(deviceId) {
    const selectedPath = ['pages', deviceId, 'selected'];

    const data = r.get('remote', 'devices', deviceId, 'data', 'data') || {};
    const [selectedType, selectedId] = r.get(selectedPath) || [];

    const isSelected = id => selectedType == 'data' && selectedId == id;
    const onClick = id => r.set(selectedPath, ['data', id]);
    const onRemove = id => common.removeData(deviceId, id);

    return ['div.data',
        tableData(Object.entries(data), false, isSelected, onClick, onRemove),
        ['div.control',
            ['button', {
                on: {
                    click: _ => common.addData(deviceId)
                }},
                ['span.fa.fa-plus'],
                ' Add data'
            ]
        ]
    ];
}


function slaveCommands(deviceId) {
    const selectedPath = ['pages', deviceId, 'selected'];

    const commands = r.get('remote', 'devices', deviceId, 'data', 'commands') || {};
    const [selectedType, selectedId] = r.get(selectedPath) || [];

    const isSelected = id => selectedType == 'command' && selectedId == id;
    const onClick = id => r.set(selectedPath, ['command', id]);
    const onRemove = id => common.removeCommand(deviceId, id);

    return ['div.commands',
        tableCommands(Object.entries(commands), isSelected, onClick, onRemove),
        ['div.control',
            ['button', {
                on: {
                    click: _ => common.addCommand(deviceId)
                }},
                ['span.fa.fa-plus'],
                ' Add command'
            ]
        ]
    ];
}


function slavePanel(deviceId) {
    const [selectedType, selectedId] = r.get('pages', deviceId, 'selected') || [];

    if (selectedType == 'data')
        return slavePanelData(deviceId, selectedId);

    if (selectedType == 'command')
        return slavePanelCommand(deviceId, selectedId);

    return [];
}


function slavePanelData(deviceId, selectedDataId) {
    const selectedData = r.get('remote', 'devices', deviceId, 'data', 'data', selectedDataId);
    if (!selectedData)
        return [];

    const onChange = u.curry((property, value) =>
        common.changeData(deviceId, selectedDataId, property, value)
    );

    return ['div.panel',
        formEntrySelect('Type', selectedData.type, dataTypes, onChange('type')),
        formEntryNumber('ASDU', selectedData.asdu, onChange('asdu')),
        formEntryNumber('IO', selectedData.io, onChange('io')),
        slavePanelDataValue(deviceId, selectedDataId),
        slavePanelDataQuality(deviceId, selectedDataId),
        timeFormEntries(selectedData.time, onChange('time')),
        formEntrySelect('Cause', selectedData.cause, dataCauses, onChange('cause')),
        formEntryCheckbox('Is test', selectedData.is_test, onChange('is_test'))
    ];
}


function slavePanelCommand(deviceId, selectedCommandId) {
    const selectedCommand = r.get('remote', 'devices', deviceId, 'data', 'commands', selectedCommandId);
    if (!selectedCommand)
        return [];

    const onChange = u.curry((path, value) =>
        common.changeCommand(deviceId, selectedCommandId, path, value)
    );

    return ['div.panel',
        formEntrySelect('Type', selectedCommand.type, commandTypes, onChange('type')),
        formEntryNumber('ASDU', selectedCommand.asdu, onChange('asdu')),
        formEntryNumber('IO', selectedCommand.io, onChange('io')),
        formEntryCheckbox('Success', selectedCommand.success, onChange('success'))
    ];
}


function slavePanelDataValue(deviceId, dataId) {
    const dataType = r.get('remote', 'devices', deviceId, 'data', 'data', dataId, 'type');
    const value = r.get('remote', 'devices', deviceId, 'data', 'data', dataId, 'value');

    const onChange = u.curry((path, value) =>
        common.changeData(deviceId, dataId, ['value', path], value)
    );

    if (dataType == 'Single')
        return [
            formEntrySelect('Value', value.Single, singleValues, onChange('Single'))
        ];

    if (dataType == 'Double')
        return [
            formEntrySelect('Value', value.Double, doubleValues, onChange('Double'))
        ];

    if (dataType == 'StepPosition')
        return [
            formEntryNumber('Value', value.StepPosition.value,
                            onChange(['StepPosition', 'value'])),
            formEntryCheckbox('Value - transient', value.StepPosition.transient,
                              onChange(['StepPosition', 'transient']))
        ];

    if (dataType == 'Bitstring')
        return [
            formEntryText('Value', value.Bitstring, onChange('Bitstring'))
        ];

    if (dataType == 'Normalized')
        return [
            formEntryNumber('Value', value.Normalized, onChange('Normalized'))
        ];

    if (dataType == 'Scaled')
        return [
            formEntryNumber('Value', value.Scaled, onChange('Scaled'))
        ];

    if (dataType == 'Floating')
        return [
            formEntryNumber('Value', value.Floating, onChange('Floating'))
        ];

    if (dataType == 'BinaryCounter')
        return [
            formEntryNumber('Value', value.BinaryCounter.value,
                            onChange(['BinaryCounter', 'value'])),
            formEntryNumber('Value - sequence', value.BinaryCounter.sequence,
                            onChange(['BinaryCounter', 'sequence'])),
            formEntryCheckbox('Value - overflow', value.BinaryCounter.overflow,
                              onChange(['BinaryCounter', 'overflow'])),
            formEntryCheckbox('Value - adjusted', value.BinaryCounter.adjusted,
                              onChange(['BinaryCounter', 'adjusted'])),
            formEntryCheckbox('Value - invalid', value.BinaryCounter.invalid,
                              onChange(['BinaryCounter', 'invalid']))
        ];

    return [];
}


function slavePanelDataQuality(deviceId, dataId) {
    const quality = r.get('remote', 'devices', deviceId, 'data', 'data', dataId, 'quality');

    const onChange = u.curry((path, value) =>
        common.changeData(deviceId, dataId, ['quality', path], value)
    );

    return [
        formEntryCheckbox('Quality - invalid', quality.invalid, onChange('invalid')),
        formEntryCheckbox('Quality - not topical', quality.not_topical, onChange('not_topical')),
        formEntryCheckbox('Quality - substituted', quality.substituted, onChange('substituted')),
        formEntryCheckbox('Quality - blocked', quality.blocked, onChange('blocked')),
        formEntryCheckbox('Quality - overflow', quality.overflow, onChange('overflow'))
    ];
}


function formEntryText(label, value, onChange) {
    return [
        ['label.label', label],
        ['input', {
            props: {
                type: 'text',
                value: value
            },
            on: {
                change: evt => onChange(evt.target.value)
            }
        }]
    ];
}


function formEntryNumber(label, value, onChange) {
    return [
        ['label.label', label],
        ['input', {
            props: {
                type: 'number',
                value: value
            },
            on: {
                change: evt => onChange(evt.target.valueAsNumber)
            }
        }]
    ];
}


function formEntryCheckbox(label, value, onChange) {
    return [
        ['span'],
        ['label',
            ['input', {
                props: {
                    type: 'checkbox',
                    checked: value
                },
                on: {
                    change: evt => onChange(evt.target.checked)
                }
            }],
            ` ${label}`
        ]
    ];
}


function formEntrySelect(label, selected, values, onChange) {
    return [
        ['label.label', label],
        ['select', {
            on: {
                change: evt => onChange(evt.target.value)
            }},
            values.map(i => ['option', {
                props: {
                    selected: i == selected
                }},
                i
            ])
        ]
    ];
}


function timeFormEntries(time, onChange) {
    const change = u.curry((property, value) =>
        onChange(u.set(property, value, time))
    );

    if (!time)
        return [
            formEntryCheckbox('Time', false, _ => change([], {
                milliseconds: 0,
                invalid: false,
                minutes: 0,
                summer_time: false,
                hours: 0,
                day_of_week: 0,
                day_of_month: 0,
                months: 0,
                years: 0
            }))
        ];

    return [
        formEntryCheckbox('Time', true, _ => change([], null)),
        formEntryNumber('Time - milliseconds', time.milliseconds, change('milliseconds')),
        formEntryCheckbox('Time - invalid', time.invalid, change('invalid')),
        formEntryNumber('Time - minutes', time.minutes, change('minutes')),
        formEntryCheckbox('Time - summer time', time.summer_time, change('summer_time')),
        formEntryNumber('Time - hours', time.hours, change('hours')),
        formEntryNumber('Time - day of week', time.day_of_week, change('day_of_week')),
        formEntryNumber('Time - day of month', time.day_of_month, change('day_of_month')),
        formEntryNumber('Time - months', time.months, change('months')),
        formEntryNumber('Time - years', time.years, change('years'))
    ];
}


function tableData(data, showTimestamp, isSelected=null, onClick=null, onRemove=null) {
    return ['table',
        ['thead',
            ['tr',
                (!showTimestamp ? [] : ['th.col-timestamp.hidden']),
                ['th.col-str.hidden'],    // type
                ['th.col-int.hidden'],    // asdu
                ['th.col-int.hidden'],    // io
                ['th.hidden'],            // value
                ['th.col-bool.hidden'],   // quality-invalid
                ['th.col-bool.hidden'],   // quality-not_topical
                ['th.col-bool.hidden'],   // quality-substituted
                ['th.col-bool.hidden'],   // quality-blocked
                ['th.col-bool.hidden'],   // quality-overflow
                ['th.col-int.hidden'],    // time-years
                ['th.col-short.hidden'],  // time-months
                ['th.col-short.hidden'],  // time-day_of_month
                ['th.col-short.hidden'],  // time-day_of_week
                ['th.col-short.hidden'],  // time-hours
                ['th.col-short.hidden'],  // time-minutes
                ['th.col-long.hidden'],   // time-milliseconds
                ['th.col-bool.hidden'],   // time-invalid
                ['th.col-bool.hidden'],   // time-summer_time
                ['th.col-str.hidden'],    // cause
                ['th.col-bool.hidden'],   // is_test
                (!onRemove ? [] : ['th.col-remove.hidden'])
            ],
            ['tr',
                (!showTimestamp ? [] : ['th', {props: {rowSpan: 2}}, 'Timestamp']),
                ['th', {props: {rowSpan: 2}}, 'Type'],
                ['th', {props: {rowSpan: 2}}, 'ASDU'],
                ['th', {props: {rowSpan: 2}}, 'IO'],
                ['th', {props: {rowSpan: 2}}, 'Value'],
                ['th', {props: {colSpan: 5}}, 'Quality'],
                ['th', {props: {colSpan: 9}}, 'Time'],
                ['th', {props: {rowSpan: 2}}, 'Cause'],
                ['th', {props: {rowSpan: 2}}, 'Test'],
                (!onRemove ? [] : ['th', {props: {rowSpan: 2}}, 'Remove'])
            ],
            ['tr',
                ['th', 'IN'],
                ['th', 'NT'],
                ['th', 'SU'],
                ['th', 'BL'],
                ['th', 'OV'],
                ['th', 'Y'],
                ['th', 'M'],
                ['th', 'DoM'],
                ['th', 'DoW'],
                ['th', 'H'],
                ['th', 'MIN'],
                ['th', 'MS'],
                ['th', 'IN'],
                ['th', 'ST']
            ]
        ],
        ['tbody', Array.from(data, ([id, i]) => {
            const val = (...path) => {
                const x = u.get(path, i);
                if (u.isNil(x))
                    return '';
                if (u.isBoolean(x))
                    return ['span.fa.fa-' + (x ? 'check' : 'times')];
                if (u.isObject(x))
                    return JSON.stringify(x);
                return String(x);
            };
            return ['tr', {
                class: {
                    selected: isSelected && isSelected(id)
                },
                on: {
                    click: _ => (onClick ? onClick(id) : null)
                }},
                (!showTimestamp ? [] : ['td.col-timestamp',
                    datetime.timestampToLocalString(i.timestamp)
                ]),
                ['td.col-str', val('type')],
                ['td.col-int', val('asdu')],
                ['td.col-int', val('io')],
                ['td', val('value', i.type)],
                ['td.col-bool', val('quality', 'invalid')],
                ['td.col-bool', val('quality', 'not_topical')],
                ['td.col-bool', val('quality', 'substituted')],
                ['td.col-bool', val('quality', 'blocked')],
                ['td.col-bool', val('quality', 'overflow')],
                ['td.col-int', val('time', 'years')],
                ['td.col-short', val('time', 'months')],
                ['td.col-short', val('time', 'day_of_month')],
                ['td.col-short', val('time', 'day_of_week')],
                ['td.col-short', val('time', 'hours')],
                ['td.col-short', val('time', 'minutes')],
                ['td.col-long', val('time', 'milliseconds')],
                ['td.col-bool', val('time', 'invalid')],
                ['td.col-bool', val('time', 'summer_time')],
                ['td.col-str', val('cause')],
                ['td.col-bool', val('is_test')],
                (!onRemove ? [] : ['td.col-remove',
                    ['button', {
                        on: {
                            click: evt => {
                                evt.stopPropagation();
                                onRemove(id);
                            }
                        }},
                        ['span.fa.fa-times']
                    ]
                ])
            ];
        })]
    ];
}


function tableCommands(commands, isSelected, onClick, onRemove) {
    return ['table',
        ['thead',
            ['tr',
                ['th.col-str.hidden'],    // type
                ['th.col-int.hidden'],    // asdu
                ['th.col-int.hidden'],    // io
                ['th.hidden'],            // value
                ['th.col-bool.hidden'],   // success
                ['th.col-remove.hidden']
            ],
            ['tr',
                ['th', 'Type'],
                ['th', 'ASDU'],
                ['th', 'IO'],
                ['th', 'Value'],
                ['th', 'Res'],
                ['th', 'Remove']
            ]
        ],
        ['tbody', Array.from(commands, ([id, i]) => {
            const val = (...path) => {
                const x = u.get(path, i);
                if (u.isNil(x))
                    return '';
                if (u.isBoolean(x))
                    return ['span.fa.fa-' + (x ? 'check' : 'times')];
                if (u.isObject(x))
                    return JSON.stringify(x);
                return String(x);
            };
            return ['tr', {
                class: {
                    selected: isSelected(id)
                },
                on: {
                    click: _ => onClick(id)
                }},
                ['td.col-str', val('type')],
                ['td.col-int', val('asdu')],
                ['td.col-int', val('io')],
                ['td', val('value', i.type)],
                ['td.col-bool', val('success')],
                ['td.col-remove',
                    ['button', {
                        on: {
                            click: evt => {
                                evt.stopPropagation();
                                onRemove(id);
                            }
                        }},
                        ['span.fa.fa-times']
                    ]
                ]
            ];
        })]
    ];
}
