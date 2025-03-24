import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.models.js";
import {Subscription} from "../models/subscription.models.js"
import { Like } from "../models/like.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { json } from "body-parser";

const getChannelStats= asyncHandler(async(req, res)=>{
    const userId= req.user?._id

    const videoCount= await Video.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: "$videoFile",
                    totalViews: {
                        $sum: "$views"
                    },
                    totalVideos: {
                        $sum: 1
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalVideos: 1,
                    totalViews: 1
                }
            }
        ]
    )

    const subscriberCount= await Subscription.aggregate(
        [
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalSuscribers: {
                        $sum: 1
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSuscribers: 1
                }
            }
        ]
    )

    const likeCount= await Like.aggregate(
        [
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "videoInfo"
                }
            },
            {
                $match: {
                    "videoInfo.owner": userId
                }
            },
            {
                $group: {
                    _id: null,
                    totalLikes: {
                        $sum: 1
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalLikes: 1
                }
            }
        ]
    )

    const info= {
        totalViews: videoCount[0].totalViews ? videoCount[0].totalViews : 0,
        totalVideos: videoCount[0].totalVideos ? videoCount[0].totalVideos : 0,
        totalSuscribers: subscriberCount[0].totalSuscribers ? subscriberCount[0].totalSuscribers : 0,
        totalLikes: likeCount[0].totalLikes ? likeCount[0].totalLikes : 0

    }

    return res.status(200).json(
        new ApiResponse(200, info, "Channel status fetched successfully")
    )
})

const getChannelVideos= asyncHandler(async(req, res)=>{
    const userId= req.user?._id
    const videos= await Video.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types(userId)
                }
            },
            {
                $project: {
                    videoFile: 1,
                    thumbnail: 1,
                    tittle: 1,
                    duration: 1,
                    views: 1,
                    isPublished: 1,
                    owner: 1,
                    createdAt: 1
                }
            }
        ]
    )

    if(!videos){
        throw new ApiError(400, "Failed to fetch the videos")
    }

    return res.status(200),json(
        new ApiResponse(200, videos[0] ? videos[0] : 0, "Channel's videos feedbeck fetched successfully")
    )
})

export{
    getChannelStats,
    getChannelVideos
}