import {ApiService, TsrpcErrorData} from "tsrpc"
import {ApiReturn, BaseServiceType, TsrpcError} from "tsrpc-proto"
import {BaseCall, BaseCallOptions} from "./base_call"
import {MsgType} from "@/protocol/message"


export interface ApiCallOptions<Req, ServiceType extends BaseServiceType> extends BaseCallOptions<ServiceType> {
    service: ApiService,
    req: Req
}


export type ApiHandler<Call extends ApiCall = ApiCall> = (call: Call) => void | Promise<void>;

export abstract class ApiCall<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends BaseCall<ServiceType>
{
    readonly type = 'api' as const;
    readonly req: Req;
    protected _return?: ApiReturn<Res>;

    protected constructor(options: ApiCallOptions<Req, ServiceType>)
    {
        super(options)
        this.req = options.req;
    }

    public get return(): ApiReturn<Res> | undefined
    {
        return this._return;
    }

    succ(res: Res): Promise<void>
    {
        return this._prepareReturn({
            isSucc: true,
            res: res
        })
    }

    error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<void>
    {
        let error: TsrpcError = typeof errOrMsg === 'string' ? new TsrpcError(errOrMsg, data) : errOrMsg;
        return this._prepareReturn({
            isSucc: false,
            err: error
        })
    };


    protected async _prepareReturn(ret: ApiReturn<Res>): Promise<void>
    {
        if (this._return) {
            return;
        }

        // Do send!
        this._return = ret;
        let opSend = await this._sendReturn(ret);
        if (!opSend.isSuccess) {
            console.error('[SendDataErr]', opSend.err);
            return;
        }
    }

    protected async _sendReturn(ret: ApiReturn<Res>): Promise<{ isSuccess : boolean, err?: TsrpcError }>
    {
        // Encode
       let opServerOutput = this.encodeApiReturn(ret)
        if (!opServerOutput.isSucc) {
            return {isSuccess : false, err : new TsrpcError(opServerOutput.errMsg)};
        }
        let opSend = await this._client.sendData(opServerOutput.output)
        if (!opSend.err) {
            return {isSuccess : true};
        }
        return {isSuccess : false, err : new TsrpcError(opSend.err)}
    }

    private encodeApiReturn(apiReturn: ApiReturn<any>): EncodeApiReturnOutput<Uint8Array> | EncodeApiReturnOutput<string>
    {
        let service = this.service as ApiService
        let opBuffer : Uint8Array
        if (apiReturn.isSucc) {
            let op = this._client._buffer.encode(apiReturn.res, service.resSchemaId);
            if (!op.isSucc) {
                return op;
            }
            opBuffer = op.buf;
            const head = Buffer.alloc(20);
            head.writeUInt32BE(this.messageHead.fd, 0);
            head.writeUint32BE(0, 4);
            head.writeUint32BE(MsgType.MessageS2Client, 8);
            head.writeUint32BE(service.id, 12);
            head.writeUint32BE(this.messageHead.sequenceId, 16);
            const packetSize = 20 + opBuffer.length
            const buff = Buffer.concat([head, opBuffer], packetSize)
            return { isSucc: true, output: buff }
        }
        else {
            // TODO:打包通用错误协议
            return  { isSucc: false, errMsg: apiReturn.err.toString() };
        }
    }
}


export declare type EncodeApiReturnOutput<T> = {
    isSucc: true;
    output: T;
    errMsg?: undefined;
} | {
    isSucc: false;
    errMsg: string;
    output?: undefined;
};