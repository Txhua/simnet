export class Counter {
    private readonly _min: number
    private readonly _max: number
    private _last: number

    constructor(min: number = 1, max: number = Number.MAX_SAFE_INTEGER) {
        this._min = min
        this._max = max
        this._last = max
    }

    reset() {
        this._last = this._max
    }

    getNext(notInc?: boolean): number {
        return this._last >= this._max ? (this._last = this._min) : notInc ? this._last : ++this._last
    }

    get last(): number {
        return this._last
    }
}
