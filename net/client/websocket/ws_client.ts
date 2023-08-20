import { BaseServiceType, ServiceProto } from 'tsrpc-proto'
import { WebSocketProxy } from './ws_socket_proxy'
import { BaseWsClient } from '../base/base_ws_client'
import {ApiCallWs} from "./api_call_ws"
import {MsgCallWs} from "./msg_call_ws"
import {MsgType} from "../../../../protocol/message"
import {Counter} from "../../module/counter"


export class WSClient<ServiceType extends BaseServiceType = any> extends BaseWsClient<ServiceType> {
    protected readonly ApiCallClass = ApiCallWs;
    protected readonly MsgCallClass = MsgCallWs;

    private _msgCounter : Counter = new Counter(1)
    constructor(proto: ServiceProto<ServiceType>, server: string) {
        const wsp = new WebSocketProxy()
        super(proto, wsp, server)
    }

    public async sendMsg<T extends string & keyof ServiceType['msg']>(fd : number, msgType : MsgType, msgName: T, msg: ServiceType['msg'][T]) : Promise<{isSucc : boolean, errMsg? : string}> {
        let service = this._serviceMap.msgName2Service[msgName as string];
        if (!service) {
            console.warn('[SendMsgErr]', `[${msgName}]`, `Invalid msg name: ${msgName}`);
            return { isSucc: false, errMsg: `Invalid msg name: ${msgName}` }
        }

        // Encode
        let op = this._buffer.encode(msg, service.msgSchemaId);
        if (!op.isSucc) {
            return op;
        }

        let headSize = 20
        const head = Buffer.alloc(headSize);
        head.writeUInt32BE(fd, 0);
        head.writeUint32BE(0, 4);
        head.writeUint32BE(msgType, 8);
        head.writeUint32BE(service.id, 12);
        head.writeUint32BE(this._msgCounter.getNext(), 16);
        const packetSize = headSize + op.buf.length
        const buff = Buffer.concat([head, op.buf], packetSize)

        // Do send!
        let opSend = await this.sendData(buff);
        if (opSend.err) {
            return { isSucc: false, errMsg : opSend.err.toString() };
        }
        return { isSucc: true };
    }

}
