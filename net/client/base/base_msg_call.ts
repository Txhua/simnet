import {MsgService} from "tsrpc"
import {BaseServiceType} from "tsrpc-proto"
import {BaseCall, BaseCallOptions} from "./base_call"


export interface MsgCallOptions<Msg, ServiceType extends BaseServiceType> extends BaseCallOptions<ServiceType>
{
    service: MsgService,
    msg: Msg
}

export type MsgHandler<Call extends MsgCall = MsgCall> = (call: Call) => void | Promise<void>;

export abstract class MsgCall<Msg = any, ServiceType extends BaseServiceType = any> extends BaseCall<ServiceType> {
    readonly type = 'msg' as const;
    readonly msg: Msg;
    protected constructor(options: MsgCallOptions<Msg, ServiceType>)
    {
        super(options);
        this.msg = options.msg;
    }
}