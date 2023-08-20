import {serviceProto, ServiceType} from '../../../src/protocol/serviceProto'
import {ServiceProto, TsrpcError, TsrpcErrorType} from "tsrpc-proto"
import {BaseWebSocketProxy} from "../../../src/engine/net/client/base/base_web_socket_proxy"
import {WebSocketProxy} from "../../../src/engine/net/client/websocket/ws_socket_proxy"
import {ReturnResult} from "../../../src/engine/net/client/base/base_ws_client"
import {ServiceMap, ServiceMapUtil} from "tsrpc"
import {TSBuffer} from "tsbuffer"
import {Counter} from "../../../src/engine/net/module/counter"
import {sleep} from "../../../src/engine/utils/common"



class FrontClient
{
    private _wsp: BaseWebSocketProxy
    private readonly _server : string
    private _serviceMap : ServiceMap
    private _buffer : TSBuffer
    protected _seqCounter = new Counter(1);

    // 等待连接成功
    private _connecting?: {
        promise: Promise<ReturnResult>
        rs: (v: ReturnResult) => void
    }

    public constructor(server : string)
    {
        this._wsp = new WebSocketProxy()
        this._wsp.options = {
            onOpen: this._onWsOpen,
            onClose: this._onWsClose,
            onError: this._onWsError,
            onMessage: this._onWsMessage,
        }
        this._server = server
        let proto = this._getProto()
        this._serviceMap = ServiceMapUtil.getServiceMap(proto)
        this._buffer = new TSBuffer({ ...proto.types })
    }

    private _getProto() : ServiceProto<ServiceType>
    {
        return  Object.merge({}, serviceProto) as ServiceProto<ServiceType>
    }

    protected _onWsOpen = () => {
        if (!this._connecting) {
            return
        }
        this._connecting.rs({ isSuccess: true })
        this._connecting = undefined
        console.log(`WebSocket connection to ${this._server} successful`)
    }

    protected _onWsClose = (code: number, reason: string) => {
        if (this._connecting) {
            this._connecting.rs({
                isSuccess: false,
                err: new TsrpcError(`Failed to connect to WebSocket server  ${this._server}`, {
                    code: 'INVALID_MSG_NAME',
                    type: TsrpcErrorType.ClientError,
                })
            })
            this._connecting = undefined
            console.error(`Failed to connect to WebSocket server: ${this._server}`)
        }
    }

    protected _onWsError = (e: unknown) => {
        console.error('[WebSocket Error]', e)
        // 连接中，返回连接失败
        if (this._connecting) {
            this._connecting.rs({
                isSuccess: false,
                err:  new TsrpcError(`Failed to connect to WebSocket server: ${this._server}`, {
                    code: 'INVALID_MSG_NAME',
                    type: TsrpcErrorType.ClientError,
                })
            })
            this._connecting = undefined
            console.error(
                `Failed to connect to WebSocket server: ${this._server}`,
            )
        }
    }

    private _onWsMessage =  (data: Buffer) => {
        this._onReceiveData(data)
    }

    private _onReceiveData(data: Buffer)
    {
        const serviceId = data.readUInt32BE(0);
        const sequenceId = data.readUInt32BE(4);

        let service = this._serviceMap.id2Service[serviceId];
        if (!service) {
            return {isSuccess: false, errMsg: `Cannot find service ID: ${serviceId}`}
        }

        // 获取包体
        let body = data.subarray(8)
        // 解码Body
        if (service.type === 'api') {
            let opReq = this._buffer.decode(body, service.resSchemaId);
            console.log("接收到后端的消息: ", opReq.value)
        } else {
            let opMsg = this._buffer.decode(body, service.msgSchemaId);
        }
    }


    public async connect()
    {
        try {
            this._wsp.connect(this._server, ['buffer'])
        } catch (e: any) {
            console.error(e)
            return { isSuccess: false, err: e.message }
        }
        console.log(`Start connecting ${this._server}`)

        this._connecting = {} as any
        const promiseConnect = new Promise<ReturnResult>((rs) => {
            this._connecting!.rs = rs
        })
        this._connecting!.promise = promiseConnect

        return promiseConnect
    }

    public async sendMsg<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'])
    {
        let service = this._serviceMap.apiName2Service[apiName as string]
        let op = this._buffer.encode(req, service!.reqSchemaId)
        const buffer = Buffer.alloc(8);
        buffer.writeUint32BE(service!.id, 0);
        buffer.writeUint32BE(this._seqCounter.getNext(), 4);
        const packetSize = 8 + op.buf!.length;
        let buf = Buffer.concat([buffer, op.buf!], packetSize)
        this._wsp.send(buf).then((rs) => {
            if (rs.err){
                console.log(rs.err)
            }
        })
    }

    public async call<T extends string & keyof ServiceType['api']>(apiName : T, req : ServiceType['api'][T]['req'])
    {
        const promise = new Promise<ReturnResult>( async(rs) => {
            // GetService
            const service = this._serviceMap.apiName2Service[apiName as string]
            if (!service) {
                console.warn('[SendMsgErr]', `[${apiName}]`, `Invalid msg name: ${apiName}`);
                rs({
                    isSuccess: false,
                    err: new TsrpcError('Invalid msg name: ' + apiName, {
                        code: 'INVALID_MSG_NAME',
                        type: TsrpcErrorType.ClientError,
                    }),
                })
                return
            }

            // Encode
            let op = this._buffer.encode(req, service!.reqSchemaId)
            const buffer = Buffer.alloc(8);
            buffer.writeUint32BE(service!.id, 0);
            buffer.writeUint32BE(this._seqCounter.getNext(), 4);
            const packetSize = 8 + op.buf!.length;
            let buf = Buffer.concat([buffer, op.buf!], packetSize)

            // Send Buf...

            const promiseSend = this._wsp.send(buf)
            const opSend = await promiseSend
            if (opSend.err) {
                rs({
                    isSuccess: false,
                    err: opSend.err,
                })
                return
            }

            rs({ isSuccess: true })
        })

        promise.then((v) => {
            if (!v.isSuccess) {
                console.error('[SendMsgErr]', v.err)
            }
        })

        return promise
    }


    public async _onOpen()
    {
        let id = 1
        console.log("send message!")
        while (1) {
            this.sendMsg("Login", {
                id: id++,
                name: 1314+id,
            }).then(() => {})
            await sleep(2000)
            //await this.sleep(2000)
        }
    }
}


async function testPromise()
{
    let promise = new Promise<ReturnResult>( async(rs) => {
        console.log("1111")
        setTimeout(() => {
            console.log("timeout")
            rs({isSuccess : true})
        }, 3000);

    })
    console.log("22")
    promise.then((v) => {
        if (!v.isSuccess) {
            console.error('[SendMsgErr]', v.err)
        }
        console.log("promise.then")
    })
    console.log("33")
    return promise

    // console.log("等待promise")
    // let rt = await  promise
    // if (rt.isSuccess)
    // {
    //     console.log("promise 执行成功")
    // }
    // console.log("结束promise")
}

async function  aa()
{
    let rt = await testPromise()
    if (rt.isSuccess) {
        console.log("结束promise")
    }
}

//aa()

let ws = new FrontClient('ws://localhost:8080')
ws.connect().then(rs => {
    if(rs.isSuccess)
    {
        ws._onOpen()
    }
})