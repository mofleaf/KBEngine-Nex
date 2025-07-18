export default class KBEDebug {
    private static _ccLog: ((...args: any[]) => void) | null = null;
    private static _ccWarn: ((...args: any[]) => void) | null = null;
    private static _ccError: ((...args: any[]) => void) | null = null;
    private static _ccDebug: ((...args: any[]) => void) | null = null;

    // 自动检测是否是 Cocos 环境
    private static detectCC() {
        if (this._ccLog !== null) return; // 已初始化
        try {
            const globalAny = globalThis as any;
            if (typeof globalAny.cc !== 'undefined') {
                const cc = globalAny.cc;
                this._ccLog = cc.log || console.log;
                this._ccWarn = cc.warn || console.warn;
                this._ccError = cc.error || console.error;
                this._ccDebug = cc.log || console.debug;
            } else {
                this._ccLog = console.log;
                this._ccWarn = console.warn;
                this._ccError = console.error;
                this._ccDebug = console.debug;
            }
        } catch (e) {
            this._ccLog = console.log;
            this._ccWarn = console.warn;
            this._ccError = console.error;
            this._ccDebug = console.debug;
        }
    }

    static DEBUG_MSG(msg: string, ...optionalParams: any[]): void {
        this.detectCC();
        optionalParams.unshift(msg);
        this._ccDebug!.apply(null, optionalParams);
    }

    static INFO_MSG(msg: string, ...optionalParams: any[]): void {
        this.detectCC();
        optionalParams.unshift(msg);
        this._ccLog!.apply(null, optionalParams);
    }

    static WARNING_MSG(msg: string, ...optionalParams: any[]): void {
        this.detectCC();
        optionalParams.unshift(msg);
        this._ccWarn!.apply(null, optionalParams);
    }

    static ERROR_MSG(msg: string, ...optionalParams: any[]): void {
        this.detectCC();
        optionalParams.unshift(msg);
        this._ccError!.apply(null, optionalParams);
    }

    static ASSERT(condition?: boolean, message?: string, ...data: any[]): void {
        if (!condition) {
            throw new Error(message || "Assertion failed");
        }
    }
}
