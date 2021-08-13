

const localTimezoneOffset = (new Date()).getTimezoneOffset() * 60;


export function timestampToLocalString(timestamp) {
    const date = new Date((timestamp - localTimezoneOffset) * 1000);
    return date.toISOString().replace('T', ' ').replace('Z', '');
}
