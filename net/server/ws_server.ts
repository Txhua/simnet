import {WSClient} from "../client/websocket/ws_client"
import {serviceProto, ServiceType} from "../../../protocol/serviceProto"
import {ServiceProto} from "tsrpc-proto"
import path from "path"
import {MsgType} from "@/protocol/message"

export class WSServer
{
    private _client : WSClient<ServiceType>

    private _getProto() : ServiceProto<ServiceType>
    {
        return  Object.merge({}, serviceProto) as ServiceProto<ServiceType>
    }

    public constructor()
    {
        this._client = new WSClient(this._getProto(), 'ws://localhost:8081')
    }

    public async start()
    {
        await this._client.autoImplementApi((path.resolve(__dirname, '../../../api')))
        await this._client.connect()
    }

    public async sendMsg<T extends string & keyof ServiceType['msg']>(fd : number, msgType : MsgType, msgName: T, msg: ServiceType['msg'][T])
    {
        return await this._client.sendMsg(fd, msgType, msgName, msg)
    }

}

const ws = new WSServer()
ws.start()