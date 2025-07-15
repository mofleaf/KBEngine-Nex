
import MemoryStream from "./MemoryStream";
import Bundle from "./Bundle";
import * as KBEMath from "./KBEMath";
import * as KBEEncoding from "./KBEEncoding";
import KBEDebug from "./KBEDebug";
import EntityDef from "./EntityDef";

const TWO_PWR_16_DBL = 1 << 16;
const TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;

export class INT64 {
	low: number;
	high: number;
	private _isNegative: boolean;

	constructor(low: number, high: number) {
		this.low = low >>> 0;

        // 这里的 >>> 0 不是为了去掉符号，而是为了确保 输入的 high 是 32 位无符号格式，也就是说你即使传入了负数，它会正确转为补码整数。
        // 但注意：后续 this._isNegative 是根据 high >>> 0 的结果来判断是否带符号的，然后我们立刻做了补码还原。
		this.high = high >>> 0;
		this._isNegative = (this.high & 0x80000000) !== 0;

		// 补码转正（存储结构中仍然保留原始补码）
		if (this._isNegative) {
			const notLow = (~this.low + 1) >>> 0;
			const carry = notLow === 0 ? 1 : 0;
			const notHigh = (~this.high + carry) >>> 0;
			this.low = notLow;
			this.high = notHigh;
		}
	}

	toNumber(): number {
		let val = this.high * TWO_PWR_32_DBL + this.low;
		return this._isNegative ? -val : val;
	}

	toBigInt(): bigint {
		let bi = (BigInt(this.high) << 32n) | BigInt(this.low);
		return this._isNegative ? -bi : bi;
	}

	toString(radix: number = 10): string {
		return this.toBigInt().toString(radix);
	}

	equals(other: INT64): boolean {
		return this.toBigInt() === other.toBigInt();
	}

	static fromNumber(num: number): INT64 {
		const isNegative = num < 0;
		if (isNegative) num = -num;

		const low = num >>> 0;
		const high = Math.floor(num / TWO_PWR_32_DBL) >>> 0;
		let int64 = new INT64(low, high);

		if (isNegative) {
			let l = (~int64.low + 1) >>> 0;
			let h = (~int64.high + (l === 0 ? 1 : 0)) >>> 0;
			int64.low = l;
			int64.high = h;
			int64._isNegative = true;
		}

		return int64;
	}

	static fromBigInt(bi: bigint): INT64 {
		const isNegative = bi < 0n;
		if (isNegative) bi = -bi;

		let low = Number(bi & 0xFFFFFFFFn);
		let high = Number((bi >> 32n) & 0xFFFFFFFFn);

		let int64 = new INT64(low, high);

		if (isNegative) {
			let l = (~int64.low + 1) >>> 0;
			let h = (~int64.high + (l === 0 ? 1 : 0)) >>> 0;
			int64.low = l;
			int64.high = h;
			int64._isNegative = true;
		}

		return int64;
	}
}


export class UINT64 {
	low: number;
	high: number;

	constructor(low: number, high: number) {
		this.low = low >>> 0;
		this.high = high >>> 0;
	}

	toNumber(): number {
		return this.high * TWO_PWR_32_DBL + this.low;
	}

	toBigInt(): bigint {
		return (BigInt(this.high) << 32n) | BigInt(this.low);
	}

	toString(radix: number = 10): string {
		return this.toBigInt().toString(radix);
	}

	equals(other: UINT64): boolean {
		return this.toBigInt() === other.toBigInt();
	}

	static fromNumber(num: number): UINT64 {
		const low = num >>> 0;
		const high = Math.floor(num / TWO_PWR_32_DBL) >>> 0;
		return new UINT64(low, high);
	}

	static fromBigInt(bi: bigint): UINT64 {
		const low = Number(bi & 0xFFFFFFFFn);
		const high = Number((bi >> 32n) & 0xFFFFFFFFn);
		return new UINT64(low, high);
	}
}

export class UINT64_OLD {
    low: number;
    high: number;

    constructor(p_low: number, p_high: number) {
        this.low = p_low >>> 0;
        this.high = p_high;
    }

    toString() {
        let low = this.low.toString(16);
        let high = this.high.toString(16);

        let result = "";
        if (this.high > 0) {
            result += high;
            for (let i = 8 - low.length; i > 0; --i) {
                result += "0";
            }
        }

        return result + low;
    }

    static BuildUINT64(data: number): UINT64 {
        let low = (data % TWO_PWR_32_DBL) | 0;
        low >>>= 0;
        let high = (data / TWO_PWR_32_DBL) | 0;
        high >>>= 0;
        //KBEDebug.WARNING_MSG("Datatypes::BuildUINT64:low:%s, low hex(%s);high:%s, high hex(%s).", low, low.toString(16), high, high.toString(16));
        return new UINT64(low, high);
    }
}


function IsNumber(anyObject: any): boolean {
    return typeof anyObject === "number" || typeof anyObject == 'boolean';
}

export abstract class DATATYPE_BASE {
    static readonly FLOATE_MAX = Number.MAX_VALUE;

    Bind(): void { }

    CreateFromStream(stream: MemoryStream): any {
        return null;
    }
    AddToStream(stream: Bundle, value: any): void {

    }
    ParseDefaultValueString(value: string): any {
        return null;
    }
    IsSameType(value: any): boolean {
        return value == null;
    }
}

export class DATATYPE_UINT8 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {

        return stream.ReadUint8();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteUint8(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < 0 || value > 0xff) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_UINT16 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadUint16();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteUint16(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < 0 || value > 0xffff) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_UINT32 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadUint32();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteUint32(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < 0 || value > 0xffffffff) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_UINT64 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadUint64();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteUint64(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        return value instanceof UINT64;
    }
}

export class DATATYPE_INT8 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadInt8();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteInt8(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < -0x80 || value > 0x7f) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_INT16 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadInt16();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteInt16(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < -0x8000 || value > 0x7fff) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_INT32 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadInt32();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteInt32(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        if (!IsNumber(value))
            return false;

        if (value < -0x80000000 || value > 0x7fffffff) {
            return false;
        }

        return true;
    }
}

export class DATATYPE_INT64 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadInt64();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteInt64(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseInt(value);
    }

    IsSameType(value: any): boolean {
        return value instanceof INT64;
    }
}

export class DATATYPE_FLOAT extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadFloat();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteFloat(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseFloat(value);
    }

    IsSameType(value: any): boolean {
        return typeof (value) === "number";
    }
}

export class DATATYPE_DOUBLE extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadDouble();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteDouble(value);
    }

    ParseDefaultValueString(value: string): any {
        return parseFloat(value);
    }

    IsSameType(value: any): boolean {
        return typeof (value) === "number";
    }
}

export class DATATYPE_STRING extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadString();
    }

    AddToStream(stream: Bundle, value: any): void {
        return stream.WriteString(value);
    }

    ParseDefaultValueString(value: string): any {
        return value;   // TODO: 需要测试正确
    }

    IsSameType(value: any): boolean {
        return typeof (value) === "string";
    }
}

export class DATATYPE_VECTOR2 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return new KBEMath.Vector2(stream.ReadFloat(), stream.ReadFloat());
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteFloat(value.x);
        stream.WriteFloat(value.y);
    }

    ParseDefaultValueString(value: string): any {
        return new KBEMath.Vector2(0.0, 0.0);
    }

    IsSameType(value: any): boolean {
        return value instanceof KBEMath.Vector2;
    }
}

export class DATATYPE_VECTOR3 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return new KBEMath.Vector3(stream.ReadFloat(), stream.ReadFloat(), stream.ReadFloat());
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteFloat(value.x);
        stream.WriteFloat(value.y);
        stream.WriteFloat(value.z);
    }

    ParseDefaultValueString(value: string): any {
        return new KBEMath.Vector3(0.0, 0.0, 0.0);
    }

    IsSameType(value: any): boolean {
        return value instanceof KBEMath.Vector3;
    }
}

export class DATATYPE_VECTOR4 extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return new KBEMath.Vector4(stream.ReadFloat(), stream.ReadFloat(), stream.ReadFloat(), stream.ReadFloat());
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteFloat(value.x);
        stream.WriteFloat(value.y);
        stream.WriteFloat(value.z);
        stream.WriteFloat(value.w);
    }

    ParseDefaultValueString(value: string): any {
        return new KBEMath.Vector4(0.0, 0.0, 0.0, 0.0);
    }

    IsSameType(value: any): boolean {
        return value instanceof KBEMath.Vector4;
    }
}


export class DATATYPE_PYTHON extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadBlob();
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteBlob(value);
    }

    ParseDefaultValueString(value: string): any {
        return new Uint8Array(0);
    }

    IsSameType(value: any): boolean {
        return value instanceof Uint8Array;
    }
}

export class DATATYPE_UNKNOW extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
    }

    AddToStream(stream: Bundle, value: any): void {
    }

    ParseDefaultValueString(value: string): any {
    }

    IsSameType(value: any): any {
    }
}

export class DATATYPE_UNICODE extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return KBEEncoding.UTF8ArrayToString(stream.ReadBlob());
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteBlob(KBEEncoding.StringToUTF8Array(value));
    }

    ParseDefaultValueString(value: string): any {
        return value;
    }

    IsSameType(value: any): boolean {
        return typeof value === "string";
    }
}

export class DATATYPE_ENTITYCALL extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        stream.ReadInt32()
        stream.ReadUint64()
        stream.ReadUint16()
        stream.ReadUint16()
        return null
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteBlob(value);
    }

    ParseDefaultValueString(value: string): any {
    }

    IsSameType(value: any): boolean {
        return false;
    }
}

export class DATATYPE_BLOB extends DATATYPE_BASE {
    CreateFromStream(stream: MemoryStream): any {
        return stream.ReadBlob();
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteBlob(value);
    }

    ParseDefaultValueString(value: string): any {
        return new Uint8Array(0);
    }

    IsSameType(value: any): boolean {
        return true;
    }
}

export class DATATYPE_ARRAY extends DATATYPE_BASE {
    type: any;

    Bind() {
        if (typeof (this.type) == "number")
            this.type = EntityDef.datatypes[this.type];
    }

    CreateFromStream(stream: MemoryStream): Array<any> {
        let size = stream.ReadUint32();
        let items = [];
        while (size-- > 0) {
            size--;
            // items.push(this.type.CreateFromStream(stream));
        }

        return items;
    }

    AddToStream(stream: Bundle, value: any): void {
        stream.WriteUint32(value.length);
        for (let i = 0; i < value.length; i++) {
            this.type.AddToStream(stream, value[i]);
        }
    }

    ParseDefaultValueString(value: string): any {
        return [];
    }

    IsSameType(value: any): boolean {
        for (let i = 0; i < value.length; i++) {
            if (!this.type.IsSameType(value[i]))
                return false;
        }

        return true;
    }
}

export class DATATYPE_FIXED_DICT extends DATATYPE_BASE {
    dictType: { [key: string]: any } = {};
    implementedBy: string;

    Bind() {
        for (let key in this.dictType) {
            //KBEDebug.DEBUG_MSG("DATATYPE_FIXED_DICT::Bind------------------->>>show (key:%s, value:%s).", key, this.dictType[key]);
            if (typeof (this.dictType[key]) == "number") {
                let utype = Number(this.dictType[key]);
                this.dictType[key] = EntityDef.datatypes[utype];
            }
        }
    }

    CreateFromStream(stream: MemoryStream): { [key: string]: any } {
        let datas = {};
        for (let key in this.dictType) {
            KBEDebug.DEBUG_MSG("DATATYPE_FIXED_DICT::CreateFromStream------------------->>>FIXED_DICT(key:%s).", key);
            datas[key] = this.dictType[key].CreateFromStream(stream);
        }

        return datas;
    }

    AddToStream(stream: Bundle, value: any): void {
        for (let key in this.dictType) {
            this.dictType[key].AddToStream(stream, value[key]);
        }
    }

    ParseDefaultValueString(value: string): any {
        return {};
    }

    IsSameType(value: any): boolean {
        for (let key in this.dictType) {
            if (!this.dictType[key].IsSameType(value[key]))
                return false;
        }
        return true;
    }
}



