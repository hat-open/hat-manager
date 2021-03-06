import r from '@hat-open/renderer';

import * as common from '../common';

import * as latest from './latest';
import * as changes from './changes';
import * as register from './register';


export function main() {
    const deviceId = r.get('deviceId');

    return ['div.page.event',
        header(deviceId),
        subpage(deviceId)
    ];
}


const subpages = [
    ['latest', 'Latest'],
    ['changes', 'Changes'],
    ['register', 'Register']
];


function header(deviceId) {
    const subpagePath = ['pages', deviceId, 'subpage'];
    const addressPath = ['remote', 'devices', deviceId, 'data', 'address'];

    const selectedSubpage = r.get(subpagePath) || 'latest';
    const address = r.get(addressPath);

    return ['div.header',
        ['div.menu', subpages.map(([subpage, title]) =>
            ['div', {
                class: {
                    selected: selectedSubpage == subpage
                },
                on: {
                    click: _ => r.set(subpagePath, subpage)
                }},
                title
            ])
        ],
        ['div.spacer'],
        ['div.form',
            ['label', 'Address'],
            ['input', {
                props: {
                    value: address
                },
                on: {
                    change: evt => common.setAddress(deviceId, evt.target.value)
                }
            }]
        ]
    ];
}


function subpage(deviceId) {
    const subpage = r.get('pages', deviceId, 'subpage') || 'latest';

    if (subpage == 'latest')
        return latest.main(deviceId);

    if (subpage == 'changes')
        return changes.main(deviceId);

    if (subpage == 'register')
        return register.main(deviceId);

    return ['div.subpage'];
}
