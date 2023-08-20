import { ApiReturn, BaseServiceType } from 'tsrpc-proto';
import {ApiCall} from "../base/base_api_call"
import {ApiService} from "tsrpc"
import {WSClient} from "./ws_client"
import {WsClientStatus} from "../base/base_ws_client"
import {BaseCallOptions} from "../base/base_call"


export interface ApiCallOptions<Req, ServiceType extends BaseServiceType> extends BaseCallOptions<ServiceType> {
    service: ApiService,
    req: Req
}

export interface ApiCallWsOptions<Req, ServiceType extends BaseServiceType> extends ApiCallOptions<Req, ServiceType> {
    _client: WSClient<ServiceType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res, ServiceType> {
    constructor(options: ApiCallWsOptions<Req, ServiceType>) {
        super(options);
    }

    protected async _prepareReturn(ret: ApiReturn<Res>): Promise<void> {
        if (this._client.status !== WsClientStatus.Opened) {
            this._return = ret;
            return;
        }

        return super._prepareReturn(ret);
    }
}