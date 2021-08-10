import * as common from '../common';


export function setAddress(deviceId, address) {
    common.execute(deviceId, 'set_address', address);
}


export function setRank(deviceId, cid, rank) {
    common.execute(deviceId, 'set_rank', cid, rank);
}
