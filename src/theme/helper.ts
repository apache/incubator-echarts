import type { EChartsExtensionInstallRegisters } from '../extension';

export function checkECharts(registers: EChartsExtensionInstallRegisters) {
    const log = function (msg: any) {
        if (typeof console !== 'undefined') {
            console && console.error && console.error(msg);
        }
    };
    if (!registers) {
        log('ECharts is not Loaded');
        return;
    }
}
