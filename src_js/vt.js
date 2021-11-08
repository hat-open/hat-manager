import r from '@hat-open/renderer';
import * as u from '@hat-open/util';

import * as datetime from './datetime';
import * as common from './common';
import * as dragger from './dragger';

import * as orchestratorVt from './orchestrator/vt';
import * as monitorVt from './monitor/vt';
import * as eventVt from './event/vt/main';
import * as iec104Vt from './iec104/vt';
import * as modbusVt from './modbus/vt';


const deviceTypes = {
    orchestrator: {
        name: 'Orchestrator',
        icon: 'icons/hat.png'
    },
    monitor: {
        name: 'Monitor Server',
        icon: 'icons/hat.png'
    },
    event: {
        name: 'Event Server',
        icon: 'icons/hat.png'
    },
    iec104_master: {
        name: 'IEC104 Master',
        icon: 'icons/iec.png'
    },
    iec104_slave: {
        name: 'IEC104 Slave',
        icon: 'icons/iec.png'
    },
    modbus_master: {
        name: 'Modbus Master',
        icon: 'icons/modbus.png'
    },
    modbus_slave: {
        name: 'Modbus Slave',
        icon: 'icons/modbus.png'
    }
};


export function main() {
    return ['div#main',
        globalHeader(),
        deviceHeader(),
        sidebar(),
        sidebarResizer(),
        page(),
        logResizer(),
        log(),
        addDialog(),
        settingsDialog()
    ];
}


function globalHeader() {
    return ['div.header.global',
        ['button', {
            on: {
                click: common.showSettingsDialog
            }},
            ['span.fa.fa-cog'],
            ' Settings'
        ],
        ['button', {
            on: {
                click: common.save
            }},
            ['span.fa.fa-floppy-o'],
            ' Save'
        ]
    ];
}


function deviceHeader() {
    const deviceId = r.get('deviceId');
    if (!deviceId)
        return ['div.header.device'];

    const device = r.get('remote', 'devices', deviceId);
    if (!device)
        return ['div.header.device'];

    return ['div.header.device',
        ['label', deviceTypes[device.type].name],
        ['input', {
            props: {
                type: 'text',
                value: device.name
            },
            on: {
                change: evt => common.setName(deviceId, evt.target.value)
            }
        }],
        ['label',
            ['input', {
                props: {
                    type: 'checkbox',
                    checked: device.autostart
                },
                on: {
                    change: evt => common.setAutoStart(deviceId, evt.target.checked)
                }
            }],
            ' Auto start'
        ],
        ['button', {
            on: {
                click: _ => common.start(deviceId)
            }},
            ['span.fa.fa-play'],
            ' Start'
        ],
        ['button', {
            on: {
                click: _ => common.stop(deviceId)
            }},
            ['span.fa.fa-stop'],
            ' Stop'
        ],
        ['button', {
            on: {
                click: _ => common.remove(deviceId)
            }},
            ['span.fa.fa-minus'],
            ' Remove'
        ]
    ];
}


function sidebar() {
    const devices = r.get('remote', 'devices') || [];
    const selectedDeviceId = r.get('deviceId');
    return ['div.sidebar',
        ['div.devices',
            u.toPairs(devices).map(([deviceId, device]) => {
                const selected = selectedDeviceId == deviceId;
                return ['div.device', {
                    class: {
                        selected: selected
                    },
                    on: {
                        click: _ => r.set('deviceId', deviceId)
                    }},
                    ['span.status.fa.fa-circle', {
                        class: {
                            [device.status]: true
                        }
                    }],
                    ['span.name', device.name],
                    ' ',
                    ['span.type', `(${deviceTypes[device.type].name})`]
                ];
            })
        ],
        ['button.add', {
            on: {
                click: common.showAddDialog
            }},
            ['span.fa.fa-plus'],
            ' Add device'
        ]
    ];
}


function sidebarResizer() {
    return ['div.sidebar-resizer', {
        on: {
            mousedown: dragger.mouseDownHandler(evt => {
                const sidebar = evt.target.parentNode.querySelector('.sidebar');
                const width = sidebar.clientWidth;
                return (_, dx) => {
                    sidebar.style.width = `${width + dx}px`;
                };
            })
        }
    }];
}


function page() {
    const deviceId = r.get('deviceId');
    if (!deviceId)
        return ['div.page'];

    const deviceType = r.get('remote', 'devices', deviceId, 'type');

    if (deviceType == 'orchestrator')
        return orchestratorVt.main();

    if (deviceType == 'monitor')
        return monitorVt.main();

    if (deviceType == 'event')
        return eventVt.main();

    if (deviceType == 'iec104_master')
        return iec104Vt.master();

    if (deviceType == 'iec104_slave')
        return iec104Vt.slave();

    if (deviceType == 'modbus_master')
        return modbusVt.master();

    if (deviceType == 'modbus_slave')
        return modbusVt.slave();

    return ['div.page'];
}


function logResizer() {
    return ['div.log-resizer', {
        on: {
            mousedown: dragger.mouseDownHandler(evt => {
                const sidebar = evt.target.parentNode.querySelector('.log');
                const height = sidebar.clientHeight;
                return (_, __, dy) => {
                    sidebar.style.height = `${height - dy}px`;
                };
            })
        }
    }];
}


function log() {
    const items = r.get('remote', 'log') || [];
    return ['div.log',
        ['table',
            ['thead',
                ['tr',
                    ['th.col-time', 'Time'],
                    ['th.col-message', 'Message']
                ]
            ],
            ['tbody', items.map(i =>
                ['tr',
                    ['td.col-time', datetime.timestampToLocalString(i.timestamp)],
                    ['td.col-message', i.message]
                ]
            )]
        ]
    ];
}


function addDialog() {
    const open = r.get('addDialog', 'open');
    if (!open)
        return [];

    return ['div.overlay', {
        on: {
            click: evt => {
                evt.stopPropagation();
                common.hideAddDialog();
            }
        }},
        ['div.dialog.add', {
            on: {
                click: evt => evt.stopPropagation()
            }},
            u.toPairs(deviceTypes).map(([deviceType, i]) => ['div.device', {
                on: {
                    click: _ => {
                        common.add(deviceType);
                        common.hideAddDialog();
                    }
                }},
                ['img.icon', {
                    props: {
                        src: i.icon
                    }
                }],
                ['span.name', i.name]
            ])
        ]
    ];
}


function settingsDialog() {
    const open = r.get('settingsDialog', 'open');
    if (!open)
        return [];

    const settings = r.get('remote', 'settings');

    return ['div.overlay', {
        on: {
            click: evt => {
                evt.stopPropagation();
                common.hideSettingsDialog();
            }
        }},
        ['div.dialog.settings', {
            on: {
                click: evt => evt.stopPropagation()
            }},
            ['span.title', 'UI'],
            ['label.label', 'Address*'],
            ['input', {
                props: {
                    type: 'text',
                    value: settings.ui.address
                },
                on: {
                    change: evt => common.setSettings(['ui', 'address'], evt.target.value)
                }
            }],
            ['span.title', 'Log'],
            ['label.label', 'Level*'],
            ['select', {
                on: {
                    change: evt => common.setSettings(['log', 'level'], evt.target.value)
                }},
                ['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(level => ['option', {
                    props: {
                        selected: level == settings.log.level
                    }},
                    level
                ])
            ],
            ['span'],
            ['label',
                ['input', {
                    props: {
                        type: 'checkbox',
                        checked: settings.log.console.enabled
                    },
                    on: {
                        change: evt => common.setSettings(['log', 'console', 'enabled'], evt.target.checked)
                    }
                }],
                ' Console*'
            ],
            ['span'],
            ['label',
                ['input', {
                    props: {
                        type: 'checkbox',
                        checked: settings.log.syslog.enabled
                    },
                    on: {
                        change: evt => common.setSettings(['log', 'syslog', 'enabled'], evt.target.checked)
                    }
                }],
                ' Syslog*'
            ],
            ['label.label', 'Syslog host*'],
            ['input', {
                props: {
                    type: 'text',
                    value: settings.log.syslog.host
                },
                on: {
                    change: evt => common.setSettings(['log', 'syslog', 'host'], evt.target.value)
                }
            }],
            ['label.label', 'Syslog port*'],
            ['input', {
                props: {
                    type: 'number',
                    value: settings.log.syslog.port
                },
                on: {
                    change: evt => common.setSettings(['log', 'syslog', 'port'], evt.target.valueAsNumber)
                }
            }],
            ['span.note', '* changes applied on restart']
        ]
    ];
}
