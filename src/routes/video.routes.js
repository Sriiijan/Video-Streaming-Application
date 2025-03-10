import { Router } from "express";
import { getAllVideos, publishAVideo } from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router= Router()
router.use(verifyJWT)

router.route("/publish-video").get(getAllVideos).post(upload.fields([
    {
        name: "videoFile",
        maxCount: 1
    },
    {
        name: "thumbnail",
        maxCount: 1
    }
]),
publishAVideo
);

export default router