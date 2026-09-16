import * as z from "zod"


export const messageValidationSchema = z.object({
    type:z.enum(['message','typing']),
    content:z.string().min(1,"message content required"),
    senderId:z.string().min(1,"senderId required"),
    chatId:z.string().min(1,"senderId required")
})