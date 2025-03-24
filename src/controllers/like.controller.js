import mongoose, { isValidObjectId } from "mongoose";
import {Like} from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Toggle like on a video 200: Ok
const toggleVideoLike= asyncHandler(async(req, res)=>{
    const {videoId}= req.params;

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Missing or Invalid video ID")
    }

    const userId= req.user?._id

    if(!userId){
        throw new ApiError(400, "User is missing")
    }

    const existingLike= await Like.findOne({
        video: new mongoose.Types.ObjectId(videoId),
        likedBy: new mongoose.Types.ObjectId(userId)
    })

    let liked
    if(existingLike){
        // unlike the video

        const deletedVideoLike= await existingLike.deleteOne()

        if(!deletedVideoLike){
            throw new ApiError(500, "Failed to unlike the video")
        }
        liked= false
    }
    else{
        //like the video

        const likedVideo= await Like.create({
            video: new mongoose.Types.ObjectId(videoId),
            likedBy: new mongoose.Types.ObjectId(userId)
        })

        if(!likedVideo){
            throw new ApiError(500, "Failed to like the video")
        }
        liked= true
    }

    const totalLikes= await Like.countDocuments({
        video: new mongoose.Types.ObjectId(videoId)
    })

    return res.status(200).json(
        new ApiResponse(200, {videoId, liked, totalLikes}, liked ? "Video liked successfully" : "Video unliked successfully")
    )
})

// Toggle like on a comment 200: Ok
const toggleCommentLike= asyncHandler(async(req, res)=>{
    const {commentId}= req.params

    if(!commentId || !isValidObjectId(commentId)){
        throw new ApiError(400, "Missing or invalid comment Id")
    }

    const userId= req.user?._id
    if(!userId){
        throw new ApiError(400, "User id is missinng")
    }

    const existingLike= await Like.findOne({
        comment: new mongoose.Types.ObjectId(commentId),
        likedBy: new mongoose.Types.ObjectId(userId)
    })

    let liked

    if(existingLike){
        // unlike the comment as it is already liked
        const deletedCommentLike= await existingLike.deleteOne()

        if(!deletedCommentLike){
            throw new ApiError(500, "Failed to unlike the comment")
        }
        liked= false
    }
    else{
        // like the comment
        const likedComment= await Like.create({
            comment: new mongoose.Types.ObjectId(commentId),
            likedBy: new mongoose.Types.ObjectId(userId)
        })

        if(!likedComment){
            throw new ApiError(500, "Failed to like the comment")
        }
        liked= true
    }

    const totalLikes= await Like.countDocuments({ // problems in counting the likes
        comment: new mongoose.Types.ObjectId(commentId)
    })

    return res.status(200).json(
        new ApiResponse(200, {commentId, liked, totalLikes}, liked ? "Comment liked successfully" : "Comment unliked successfully")
    )
})

const toggleTweetLike= asyncHandler(async(req, res)=>{
    const {tweetId}= req.params

    if(!tweetId || !isValidObjectId(tweetId)){
        throw new ApiError(400, "Missing or Invalid tweet Id")
    }

    const userId= req.user?._id

    if(!req.user){
        throw new ApiError(400, "User is missing")
    }

    const existingLike=  await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    })

    let liked
    if(existingLike){
        const deleteTweetlike= await Like.deleteOne()
        if(!existingLike){
            throw new ApiError(500, "Failed to unlike the tweet")
        }
        liked= false
    }
    else{
        const likedTweet= await Like.create({
            tweet: tweetId,
            likedBy: userId
        })

        if(!likedTweet){
            throw new ApiError(500, "Failed to like tweet")
        }
        liked= true
    }

    const totalLikes= await Like.countDocuments({
        tweet: tweetId
    })

    return res.status(200).json(
        new ApiResponse(200, {tweetId, liked, totalLikes}, liked ? "Tweet liked successfully" : "Tweet unliked successfully")
    )
})

// Get all liked videos 200: Ok
const getLikedVideos= asyncHandler(async(req, res)=>{
    const userId= req.user?._id

    if(!userId){
        throw new ApiError(404, "User not found")
    }

    const likedVideos= await Like.aggregate(
        [
            {
                $match: {
                    likedBy: userId,
                    video: {
                        $exists: true,
                        $ne: null
                    }
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "video",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            username: 1,
                                            fullname: 1,
                                            avatar: 1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        },
                        {
                            $project: {
                                videoFile: 1,
                                thumbnail: 1,
                                title: 1,
                                duration: 1,
                                views: 1,
                                owner: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: { // Converts the "video" field (which was an array) into a single object
                    path: "$video"
                }
            },
            {
                $project: {
                    video: 1,
                    likedBy: 1
                }
            }
        ]
    )

    if(!likedVideos){
        throw new ApiError(400, "Failed to fetch liked videos")
    }

    return res.status(200).json(
        new ApiResponse(200, likedVideos, "successfully fetched videos")
    )
})

export{
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
}