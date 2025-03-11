import mongoose, { Aggregate, isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary, deleteVideoFromCloudinary} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    // TODO: get all videos based on query, sort, pagination

    // use match for query on the basis of title or description or i think we can do channel also
    // perfom lookup for the user details for the video like username, avatar, etc
    // project the details of the user
    // use sort to sort the videos

    const videos= await Video.aggregate(
        [
            // match stage for filtering
            {
                $match:{
                    $or: [
                        {
                            title: {$regex: query || "", $options: "i"}
                        },
                        {
                            description: {$regex: query || "", $options: "i"}
                        }
                    ]
                }
            },
            // lookup to fetch owner details
            {
                $lookup:{
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "createdBy",
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]            
                }
            },
            // Extracts the first owner from the array to simplify frontend handling
            {
                $addFields: {
                    owner: {
                        $first: "$createdBy"
                    }
                }
            },
            // project required details
            {
                thumbnail: 1,
                videoFile: 1,
                title: 1,
                description: 1,
                createdBy: 1
            },
            // sorting
            {
                $sort:{
                    [sortBy]: sortType === "asc"? 1 : -1
                }
            },
            //pagination
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: parseInt(limit)
            }
        ]
    )

    if(videos.length){
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(
        new ApiResponse(200, videos[0], "videos fetched successfully")
    )
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

// get video by id
const getVideoById= asyncHandler(async(req, res)=>{
    const {videoId}= req.params
    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }
    
    const video= await Video.findById(videoId).populate("owner", "name username avatar")

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"))
})

const updateVideo= asyncHandler (async(req, res)=>{
    const {videoId}= req.params
    const {title, description}= req.body
    const newThumbnailLocalPath= req.file?.path

    if(!videoId || isValidObjectId(videoId)){
        new ApiError(400, "Give a valid video Id")
    }

    if(!title || !description){
        throw new ApiError(400, "Title and description is missing")
    }

    if(!newThumbnailLocalPath){
        throw new ApiError(400, "Thumbnail is required")
    }

    const video= findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    if(!video.owner.equals(req.user._id)){
        throw new ApiError(403, "You are not allowed to update another user's video")
    }

    try {
        await deleteFromCloudinary(video.thumbnail)
    } catch (error) {
        throw new ApiError(500, "error while deleting the prvious thumbnail")
    }

    const newThumbnail= await uploadOnCloudinary(newThumbnailLocalPath)

    if(!newThumbnail){
        throw new ApiError(400, "Error whiile uploading new thumbnail")
    }

    const updateVideo= await Video.findByIdAndDelete(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail: newThumbnail.url
            }
        },
        {new: true}
    )
    return res.status(200).json(
        new ApiResponse(200, "Video details updated")
    )
})

const deleteVideo= asyncHandler(async(req, res)=>{
    const {videoId}= req.params

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "video Id is required or invalid")
    }

    const video= await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "video not found")
    }

    if(!video.owner.equals(req.user._id)){
        throw new ApiError(403, "you are not allowed to delete another's video")
    }

    const deletedVideoFile= await deleteVideoFromCloudinary(video.videoFile)

    if(!deletedVideoFile || deletedVideoFile.result != 'ok'){
        throw new ApiError(500, "Error while deleting video")
    }

    const deletedThumbnail= await deleteFromCloudinary(video.thumbnail)

    if(!deletedThumbnail || deletedThumbnail.result != 'ok'){
        throw new ApiError(500, "Error while deleting thumbnail")
    }

    const deletedVideo= await Video.findByIdAndDelete(videoId)

    if(!deleteVideo){
        throw new ApiError(500, "Error while deleting video")
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "video deleted successfully")
    )
})

const togglePublishStatus= asyncHandler(async(req, res)=>{
    const {videoId}= req.params

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "video id is required")
    }

    const video= await Video.findById(videoId)

    if(!video){
        throw new ApiError(500, "video not found")
    }

    if(!video.owner.equals(req.user._id)){
        throw new ApiError(403,  "you are not allowed to update another's video")
    }

    const videoPublishStatus= await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        {new: true}
    )

    return res.status(200).json(
        new ApiResponse(200, videoPublishStatus, "Video publish status modified")
    )
})

export {
    publishAVideo,
    getAllVideos,
    getVideoById,
    updateVideo,
    togglePublishStatus
};
