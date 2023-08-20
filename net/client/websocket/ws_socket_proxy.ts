import { WebSocket } from 'ws'
import { TsrpcError } from 'tsrpc-proto'
import {BaseWebSocketProxy} from "../base/base_web_socket_proxy"

export class WebSocketProxy implements BaseWebSocketProxy {
    options!: BaseWebSocketProxy['options']

    private _ws?: WebSocket

    public connect(server: string, protocols?: string[]): void {
        this._ws = new WebSocket(server, protocols)
        this._ws.onopen = this.options.onOpen
        this._ws.onclose = (e) => {
            this.options.onClose(e.code, e.reason)
            this._ws = undefined
        }
        this._ws.onerror = (e) => {
            this.options.onError(e.error)
        }
        this._ws.onmessage = (e) => {
            let data: Buffer
            if (e.data instanceof ArrayBuffer) {
                data = Buffer.from(e.data);
            }
            else if (Array.isArray(e.data)) {
                data = Buffer.concat(e.data)
            }
            else if (Buffer.isBuffer(e.data)) {
                data = e.data;
            }else {
                console.log("receiver message failed!")
                return
            }
            this.options.onMessage(data)
        }
    }

    public close(code?: number, reason?: string): void {
        this._ws?.close(code, reason)
        this._ws = undefined
    }

    public send(data: string | Uint8Array): Promise<{ err?: TsrpcError | undefined }> {
        return new Promise((rs) => {
            this._ws?.send(data, (err) => {
                if (err) {
                    rs({
                        err: new TsrpcError('Network Error', {
                            code: 'SEND_BUF_ERR',
                            type: TsrpcError.Type.NetworkError,
                            innerErr: err,
                        }),
                    })
                    return
                }
                rs({})
            })
        })
    }
}
