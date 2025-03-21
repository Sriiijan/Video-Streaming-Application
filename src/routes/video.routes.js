import { Router } from "express";
import { getAllVideos, getVideoById, publishAVideo, deleteVideo, updateVideo,  togglePublishStatus} from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router= Router()
router.use(verifyJWT)

router.route("/").get(getAllVideos).post(upload.fields([
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

router.route("/:videoId").get(getVideoById)
router.route("/:videoId").delete(deleteVideo)
router.route("/:videoId").patch(upload.single("thumbnail"), updateVideo)
router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router