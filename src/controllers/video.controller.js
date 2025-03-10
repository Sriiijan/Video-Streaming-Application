import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    // TODO: get all videos based on query, sort, pagination
});


// video upload
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    
    // console.log("Received Files:", req.files);
    // console.log("Request Body:", req.body); 

    if (!title || !description) {
        throw new ApiError(400, "Details of video are required");
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is missing");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is missing");
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Video is required");
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail is required");
    }

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        owner: req.user._id
    });

    if (!video) {
        throw new ApiError(500, "Something went wrong while uploading video");
    }

    return res.status(200).json(
        new ApiResponse(200, video, "Video uploaded successfully")
    );
});



export {
    publishAVideo,
    getAllVideos
};
