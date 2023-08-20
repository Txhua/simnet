import {BaseServiceType} from "tsrpc-proto"
import {ApiService, MsgService} from "tsrpc"
import {MessageHead} from "./message"
import {BaseWsClient} from "./base_ws_client"

export interface BaseCallOptions<ServiceType extends BaseServiceType>
{
    _client: BaseWsClient<ServiceType>,
    service: ApiService | MsgService
    messageHead : MessageHead
}


export abstract class BaseCall<ServiceType extends BaseServiceType>
{
    readonly _client: BaseWsClient<ServiceType>;
    readonly service: ApiService | MsgService;
    readonly startTime: number;
    readonly messageHead : MessageHead

    protected constructor(options: BaseCallOptions<ServiceType>)
    {
        this._client = options._client;
        this.service = options.service;
        this.startTime = Date.now();
        this.messageHead = options.messageHead
    }
}