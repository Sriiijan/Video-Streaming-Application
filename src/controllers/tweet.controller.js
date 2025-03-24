import mongoose, {isValidObjectId} from "mongoose";
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet= asyncHandler(async(req, res)=>{
    const userId= req.user?._id

    if(!userId || isValidObjectId(userId)){
        throw new ApiError(400, "Missing or invalid user Id")
    }

    const {content}= req.body

    if(!content){
        throw new ApiError(400, "Please provide content fro tweet")
    }

    const tweet= await Tweet.create({
        content,
        owner: userId
    })

    if(!tweet){
        throw new ApiError(400, "Failed to create the tweet")
    }

    return res.status(200).json(
        new ApiResponse(200, tweet, "Tweet created successfully") 
    )
})

const getUsersTweet= asyncHandler(async(req, res)=>{
    const {userId}= req.params

    if(!userId || isValidObjectId(userId)){
        throw new ApiError(400, "Missing or invalid user Id")
    }

    const {page= 1, limit= 10}= req.query

    const tweets= Tweet.aggregate(
        [
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignFiled: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullName: 1,
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
                    content: 1,
                    owner: 1,
                    createdAt: 1
                }
            },
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: paeseInt(limit)
            }
        ]
    )

    if(!tweets){
        throw new ApiError(400, "failed to fetch the tweets")
    }
    
    return res.status(200).json(
        new ApiResponse(200, tweets, "Tweets fetched successfully")
    )
})

const updateTweet= asyncHandler(async(req, res)=>{
    const {tweetId}= req.params
    
    if(!tweetId || !isValidObjectId(tweetId)){
        throw new ApiError(400, "Missing or Ivalid tweet ID")
    }

    const userId= req.user?._id
    
    const {content}= req.body

    if(!content){
        throw new ApiError(400, "Please provide some content")
    }

    const tweet= await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "Tweet not found")
    }

    if(!tweet.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to update another's tweet")
    }

    const updateTweet= await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {new: true}
    )

    if(!updateTweet){
        throw new ApiError(201, "Failed to update the tweet")
    }

    return res.status(200).json(
        new ApiResponse(200, updateTweet, "Tweet updated successfully")
    )
})

const deleteTweet= asyncHandler(async(req, res)=>{
    const {tweetId}= req.params

    if(!tweetId || !isValidObjectId(tweetId)){
        throw new ApiError(400, "Misiing or invalid tweet ID")
    }

    const userId= req.user?._id

    const tweet= await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404, "Tweet not found")
    }

    if(!tweet.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to delete another's tweet")
    }

    const deletdTweet= await Tweet.findByIdAndDelete(tweetId)

    if(!deletdTweet){
        throw new ApiError(400, "Failed to delete the tweet")
    }

    return res.status(200).json(
        new ApiResponse(200, deletdTweet, "Tweet deleted successfully")
    )
})

export{
    createTweet,
    getUsersTweet,
    updateTweet,
    deleteTweet
}