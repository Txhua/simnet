import {ApiServiceDef, BaseServiceType, MsgServiceDef, ServiceProto, TsrpcError, TsrpcErrorType} from 'tsrpc-proto'
import {ApiService, MsgService, ServiceMap, ServiceMapUtil, TransportDataUtil} from "tsrpc"
import {TSBuffer} from "tsbuffer"
import path from "path"
import {ApiHandler, ApiCall} from './base_api_call'
import {MessageHead, ParseInput} from "./message"
import {BaseWebSocketProxy} from "./base_web_socket_proxy"
import {MsgCall, MsgHandler} from "./base_msg_call"
import {MsgType} from "../../../../protocol/message"


export enum WsClientStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED',
}

export interface ReturnResult
{
    isSuccess: boolean
    err?: TsrpcError
}


export abstract class BaseWsClient<ServiceType extends BaseServiceType = any>{
    protected _wsp: BaseWebSocketProxy

    private _status: WsClientStatus = WsClientStatus.Closed

    private readonly _server : string

    readonly _serviceMap: ServiceMap

    readonly _buffer: TSBuffer

    protected _apiHandlers: { [apiName: string]: ApiHandler<any> | undefined } = {};
    protected _msgHandlers: { [msgName: string]: MsgHandler<any> | undefined } = {}

    protected abstract readonly ApiCallClass: { new(options: any): ApiCall };
    protected abstract readonly MsgCallClass: { new(options: any): MsgCall}

    public abstract sendMsg<T extends string & keyof ServiceType['msg']>(fd : number, msgType : MsgType, msgName: T, msg: ServiceType['msg'][T]) : Promise<{isSucc : boolean, errMsg? : string}>

    protected constructor(proto: ServiceProto<ServiceType>, wsp: BaseWebSocketProxy, server: string) {
        this._wsp = wsp
        this._serviceMap = ServiceMapUtil.getServiceMap(proto)
        const types = { ...proto.types }
        this._buffer = new TSBuffer(types)
        wsp.options = {
            onOpen: this._onWsOpen,
            onClose: this._onWsClose,
            onError: this._onWsError,
            onMessage: this._onWsMessage,
        }
        this._server = server
        console.log(`WebSocket Client : ${server}`)
    }
    implementApi<Api extends string & keyof ServiceType['api'], Call extends ApiCall<ServiceType['api'][Api]['req'], ServiceType['api'][Api]['res']>>(apiName: Api, handler: ApiHandler<Call>): void {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
        console.log(`API implemented success: [${apiName}]`);
    };

    async autoImplementApi(apiPath: string): Promise<{ succ: string[], fail: string[] }> {
        let apiServices = Object.values(this._serviceMap.apiName2Service) as ApiServiceDef[];
        let output: { succ: string[], fail: string[] } = { succ: [], fail: [] }

        for (let svc of apiServices) {
            //get api handler
            let { handler, errMsg } = await this.getApiHandler(svc, apiPath)

            if (!handler) {
                console.error(errMsg)
                output.fail.push(svc.name);
                continue
            }

            this.implementApi(svc.name, handler);
            output.succ.push(svc.name);
        }
        return output;
    }

    async getApiHandler(svc: ApiServiceDef, apiPath?: string): Promise<{ handler: ApiHandler, errMsg?: undefined } | { handler?: undefined, errMsg: string }> {
        if (this._apiHandlers[svc.name]) {
            return { handler: this._apiHandlers[svc.name]! };
        }

        if (!apiPath) {
            return { errMsg: `Api not implemented: ${svc.name}` };
        }

        // get api last name
        let match = svc.name.match(/^(.+\/)*(.+)$/);
        if (!match) {
            console.error('Invalid apiName: ' + svc.name);
            return { errMsg: `Invalid api name: ${svc.name}` };
        }
        let handlerPath = match[1] || '';
        let handlerName = match[2];

        // try import
        let modulePath = path.resolve(apiPath, handlerPath, 'Api' + handlerName);
        try {
            var handlerModule = await import(modulePath);
        }
        catch (e: unknown) {
            return { errMsg: (e as Error).message };
        }

        // 优先 default，其次 ApiName 同名
        let handler = handlerModule.default ?? handlerModule['Api' + handlerName];
        if (handler) {
            return { handler: handler };
        }
        else {
            return { errMsg: `Missing 'export Api${handlerName}' or 'export default' in: ${modulePath}` }
        }
    }

    protected getMsgHandler(svc : MsgServiceDef) : { isSuccess : true, handler: MsgHandler} | { isSuccess : false,  errMsg: string }
    {
        if (this._msgHandlers[svc.name]) {
            return { isSuccess: true, handler: this._msgHandlers[svc.name]! };
        }
        return  { isSuccess: false, errMsg: `Msg not listen: ${svc.name}` };
    }

    protected _onWsOpen = () => {
        if (!this._connecting) {
            return
        }
        this._status = WsClientStatus.Opened
        this._connecting.rs({ isSuccess: true })
        this._connecting = undefined
        console.log(`WebSocket connection to ${this._server} successful`)
    }

    protected _onWsClose = (code: number, reason: string) => {
        // 防止重复执行
        if (this._status === WsClientStatus.Closed) {
            return
        }

        const isManual = !!this._rsDisconnecting
        const isConnectedBefore = this.isConnected || isManual
        this._status = WsClientStatus.Closed

        // 连接中，返回连接失败
        if (this._connecting) {
            this._connecting.rs({
                isSuccess: false,
                err: new TsrpcError(`Failed to connect to WebSocket server  ${this._server}`, {
                    code: 'INVALID_MSG_NAME',
                    type: TsrpcErrorType.ClientError,
                })
                //'Failed to connect to WebSocket server  ws://localhost:8082',
            })
            this._connecting = undefined
            console.error(`Failed to connect to WebSocket server: ${this._server}`)
        }

        // disconnect中，返回成功
        if (this._rsDisconnecting) {
            this._rsDisconnecting()
            this._rsDisconnecting = undefined
            console.log('Disconnected success', `code=${code} reason=${reason}`)
        } else if (isConnectedBefore) {
            // 非 disconnect 中，从连接中意外断开
            console.log(`Lost connection to ${this._server}`, `code=${code} reason=${reason}`,)
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

    protected _onWsMessage =  (data: Buffer) => {
        if (this._status !== WsClientStatus.Opened) {
            return
        }
        let _ = this._onReceiveData(data)
    }

    // 绑定消息回调
    public listenMsg<T extends string & keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][T]>>(msgName: T, handler: MsgHandler<Call>): MsgHandler<Call>
    {
        if (this._apiHandlers[msgName as string]) {
            throw new Error('Already exist handler for MSG: ' + msgName);
        }
        this._apiHandlers[msgName as string] = handler;
        console.log(`MSG listen success: [${msgName}]`);
        return handler;
    }

    public async sendData(data: Uint8Array | string): Promise<{ err?: TsrpcError }> {
        return new Promise<{ err?: TsrpcError | undefined }>((rs) => {
            if (!this.isConnected) {
                rs({
                    err: new TsrpcError('WebSocket is not connected', {
                        code: 'WS_NOT_OPEN',
                        type: TsrpcError.Type.ClientError,
                    }),
                })
                return
            }

            // Do Send
            rs(this._wsp.send(data))
        })
    }

    public _parseServerInput(tsbuffer: TSBuffer, serviceMap: ServiceMap, data: Buffer): {isSuccess : boolean, result: ParseInput } | { isSuccess: false, errMsg: string}
    {
        const sendId = data.readUInt32BE(0);
        const messageType = data.readUInt32BE(4);
        const serviceId = data.readUInt32BE(8);
        const sequenceId = data.readUInt32BE(12);

        // 确认是哪个Service
        let service = serviceMap.id2Service[serviceId];
        if (!service) {
            return {isSuccess: false, errMsg: `Cannot find service ID: ${serviceId}`}
        }

        const head : MessageHead = {
            fd: sendId,
            msgType: messageType,
            serviceId: serviceId,
            sequenceId: sequenceId,
        }

        // 获取包体
        let body = data.slice(16)
        // 解码Body
        if (service.type === 'api') {
            let opReq = tsbuffer.decode(body, service.reqSchemaId);
            return opReq.isSucc ? {
                isSuccess: true,
                result: {
                    head : head,
                    type: 'api',
                    service: service,
                    req: opReq.value,
                }
            } : {isSuccess: false, errMsg: opReq.errMsg}
        } else {
            let opMsg = tsbuffer.decode(body, service.msgSchemaId);
            return opMsg.isSucc ? {
                isSuccess: true,
                result: {
                    head:head,
                    type: 'msg',
                    service: service,
                    req: opMsg.value
                }
            } : {isSuccess: false, errMsg: opMsg.errMsg};
        }
    }

    protected async _onReceiveData(data: Buffer)
    {
        let opInput = this._parseServerInput(this._buffer, this._serviceMap, data)
        if (!opInput.isSuccess){
            return
        }

        let call = this.makeCall(opInput.result)
        if (call.type === 'api') {
            await this._onApiCall(call)
        } else if (call.type === 'msg') {
            await this._onMsgCall(call)
        }
    }

    public makeCall(input: ParseInput): ApiCall | MsgCall
    {
        if (input.type === 'api') {
            return new this.ApiCallClass({
                _client: this,
                service: input.service,
                req: input.req,
                messageHead: input.head
            })
        }else{
            return new this.MsgCallClass({
                _client: this,
                service: input.service,
                msg: input.req,
                messageHead: input.head
            })
        }
    }

    protected async _onMsgCall(call: MsgCall)
    {
        let service = call.service as MsgService

        let opHandler  = this.getMsgHandler(service)

        if (!opHandler.isSuccess)
        {
            console.error(opHandler.errMsg)
            return
        }

        try {
            await opHandler.handler(call);
        }
        catch (e: any) {
            console.error('[MsgHandlerError]', e)
        }
    }

    protected async _onApiCall(call: ApiCall)
    {
        let service = call.service as ApiService
        let { handler } = await this.getApiHandler(service);
        // exec API handler
        if (handler) {
            try {
                await handler(call);
            }
            catch (e: any) {
                call.error(e);
            }
        }
        // 未找到ApiHandler，且未进行任何输出
        else {
            call.error(`Unhandled API: ${call.service.name}`, { code: 'UNHANDLED_API', type: TsrpcErrorType.ServerError });
        }
    }


    public get status(): WsClientStatus {
        return this._status
    }

    public get isConnected(): boolean {
        return this._status === WsClientStatus.Opened
    }

    private _connecting?: {
        promise: Promise<ReturnResult>
        rs: (v: ReturnResult) => void
    }

    async connect(): Promise<ReturnResult> {
        // 已连接成功
        if (this.isConnected) {
            return { isSuccess: true }
        }

        // 已连接中
        if (this._connecting) {
            return this._connecting.promise
        }

        try {
            this._wsp.connect(this._server, ['buffer'])
        } catch (e: any) {
            console.error(e)
            return { isSuccess: false, err: e.message }
        }
        this._status = WsClientStatus.Opening
        console.log(`Start connecting ${this._server}`)

        this._connecting = {} as any
        const promiseConnect = new Promise<ReturnResult>((rs) => {
            this._connecting!.rs = rs
        })
        this._connecting!.promise = promiseConnect

        return promiseConnect
    }

    private _rsDisconnecting?: () => void

    /**
     * Disconnect immediately
     * @throws never
     */
    async disconnect(code?: number, reason?: string) {
        if (this._status === WsClientStatus.Closed) {
            return
        }

        this._status = WsClientStatus.Closing
        console.log('Start disconnecting...')
        let isClosed = false
        return Promise.race([
            // 正常等待 onClose 关闭
            new Promise<void>((rs) => {
                this._rsDisconnecting = () => {
                    if (isClosed) {
                        return
                    }
                    isClosed = true

                    rs()
                }

                this._wsClose(code ?? 1000, reason ?? '')
            }),
            // 超时保护，1 秒未收到关闭请求的，直接 onClose 掉
            new Promise<void>(() => {
                setTimeout(() => {
                    if (isClosed) {
                        return
                    }
                    isClosed = true

                    this._onWsClose(
                        1005,
                        'Connection closed, but not received ws.onClose event.',
                    )
                }, 1000)
            }),
        ])
    }

    private _wsClose(code?: number, reason?: string) {
        try {
            this._wsp.close(code ?? 1000, reason ?? '')
        } catch (e) {
            console.error('[WsCloseError]', e)
        }
    }
}
