import 'dotenv/config';
import {Pool} from "pg"

if(!process.env.DATABASE_URL){
    throw new Error("DATABASE_URL is missing")
}



export const pool = new Pool({
    connectionString:process.env.DATABASE_URL
})


pool.on("connect",()=>{
    console.log("data base connected successfully")
})

pool.on("error",()=>{
    console.log("an error happened while connection with database")
})