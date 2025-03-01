import {Router} from "express";
import { registerUser } from "../controllers/user.controller.js";  // Fix path

const router= Router()

router.route("/register").post(registerUser)

export default router