import {WSClient} from "@/engine/net/client/websocket/ws_client"
import {BaseServiceType} from "tsrpc-proto"
import {MsgCall, MsgCallOptions} from "../base/base_msg_call"


export interface MsgCallWsOptions<Msg, ServiceType extends BaseServiceType> extends MsgCallOptions<Msg, ServiceType> {
    _client: WSClient<ServiceType>;
}
export class MsgCallWs<Msg = any, ServiceType extends BaseServiceType = any> extends MsgCall<Msg, ServiceType>
{
    //readonly _client!: WSClient<ServiceType>;
    constructor(options: MsgCallWsOptions<Msg, ServiceType>)
    {
        super(options);
    }
}