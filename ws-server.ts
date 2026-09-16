import "dotenv/config";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import { pool } from "./db.js";
import { messageValidationSchema } from "./validation.js";
const port  = Number(process.env.PORT)

const server = new WebSocketServer({port,host: "0.0.0.0",})


type IncomingMessage = {
    content:string,
    senderId:string,
    chatId:string
}


type ConnectedClient = WebSocket & {
    userId:string,
    chatId:string
}



server.on("listening",()=>{
    console.log(`server running at port: ${port}`)
})


server.on("connection",(socket:ConnectedClient, request)=>{
    const url = new URL(request.url ??"/", `http://${request.headers.host}`)
    const userId = url.searchParams.get("userId")
    const chatId = url.searchParams.get("chatId")

    if(!userId || !chatId){
        socket.close(1008,"userID and ChatID ara required");
        return
    }


    socket.userId = userId
    socket.chatId = chatId

    socket.on("message",async (receivedData)=>{
        try {
            const data:IncomingMessage = JSON.parse(receivedData.toString());

            const validationResult = messageValidationSchema.safeParse({content:data.content, senderId:data.senderId, chatId:data.chatId})

            if(!validationResult.success){
                socket.send(JSON.stringify({
                    success:false,
                    type:"error",
                    message:validationResult.error.issues
                }));
                return
            }


            if(data.senderId !== socket.userId){
                socket.send(JSON.stringify({
                    success:false,
                    type:"error",
                    message:"Invalid sender"
                }))

                return
            }

            if(data.chatId !== socket.chatId){
                socket.send(JSON.stringify({
                    success:false,
                    type:"error",
                    message:"Invalid chat"
                }))

                return
            }

            const messageId = randomUUID()

            const result = await pool.query(
            `
                INSERT INTO "Message" (
                "id",
                "content",
                "chatId",
                "senderId",
                "createdAt",
                "updatedAt"
                )
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                RETURNING
                "id",
                "content",
                "chatId",
                "senderId",
                "isRead",
                "createdAt",
                "updatedAt";
            `,
            [
                messageId,
                data.content,
                socket.chatId,
                socket.userId,
            ],
            );


            const savedMessage = result.rows[0];
            

            for(const client of server.clients as Set<ConnectedClient>){
                const shouldReceiveMessage = client.readyState === WebSocket.OPEN && client.chatId === savedMessage.chatId;

                if(shouldReceiveMessage){
                    client.send(JSON.stringify({
                        success:true,
                        type:"new_message",
                        message:savedMessage
                    }))
                }
            }


        } catch (error) {
            console.error("Failed to process message:", error);

            socket.send(
                JSON.stringify({
                type: "error",
                message: "Could not process message",
                }),
            );
            
        }
    })
    
})



async function shutdown() {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
