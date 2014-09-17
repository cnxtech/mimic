
// colorize output

import Util = require('./Util')

export function green(s: string) {
    return xterm(2)(s);
}
export function red(s: string) {
    return xterm(1)(s);
}
export function xterm(n: number): (s: string) => string {
    return (s: string) => {
        return '\033[38;5;'+n+'m' + s + '\033[0m'
    }
}
export function lightgrey(s: string) {
    return xterm(240)(s);
}
export function Gray(s: string) {
    Util.print(xterm(242)(s))
}
export function Green(s: string) {
    Util.print(xterm(2)(s))
}
export function Red(s: string) {
    Util.print(xterm(1)(s))
}