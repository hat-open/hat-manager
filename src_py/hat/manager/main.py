"""Manager main"""

from pathlib import Path
import asyncio
import contextlib
import logging.config
import sys
import typing

import appdirs
import click

from hat import aio
from hat import json
from hat.manager import common
from hat.manager.server import create_server


mlog: logging.Logger = logging.getLogger('hat.manager.main')
"""Module logger"""

user_conf_dir: Path = Path(appdirs.user_config_dir('hat'))
"""User configuration directory path"""


@click.command()
@click.option('--conf', default=None, metavar='PATH', type=Path,
              help="configuration defined by hat-manager://main.yaml# "
                   "(default $XDG_CONFIG_HOME/hat/manager.{yaml|yml|json})")
def main(conf: typing.Optional[Path]):
    """Main entry point"""
    loop = aio.init_asyncio()

    conf, conf_path = None, conf
    if not conf_path:
        for suffix in ('.yaml', '.yml', '.json'):
            conf_path = (user_conf_dir / 'manager').with_suffix(suffix)
            if conf_path.exists():
                break
    if conf_path.exists():
        conf = json.decode_file(conf_path)
    else:
        conf = common.default_conf
    common.json_schema_repo.validate('hat-manager://main.yaml#', conf)

    logging.config.dictConfig(conf['log'])

    with contextlib.suppress(asyncio.CancelledError):
        aio.run_asyncio(async_main(conf, conf_path), loop=loop)


async def async_main(conf: json.Data,
                     conf_path: Path):
    """Async main entry point"""
    srv = await create_server(conf, conf_path)
    try:
        await srv.wait_closing()
    finally:
        await aio.uncancellable(srv.async_close())


if __name__ == '__main__':
    sys.argv[0] = 'hat-manager'
    sys.exit(main())
