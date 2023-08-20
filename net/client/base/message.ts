import {ApiService, MsgService} from "tsrpc"


export type MessageHead = { fd : number, msgType : number, serviceId : number, sequenceId : number}
export type ParseInput = { head : MessageHead, type: string, service: ApiService | MsgService, req: any}
