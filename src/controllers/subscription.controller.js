import mongoose, {isValidObjectId} from "mongoose";
import {Subscription} from "../models/subscription.models.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Subscribe or unsubscribe a channel 200: OK
const toggleSubscription= asyncHandler(async(req, res)=>{
    const {channelId}= req.params

    if(!channelId || !isValidObjectId(channelId)){
        throw new ApiError(400, "Missing or invalid channel Id")
    }

    const userId= req.user?._id

    const subscribed= await Subscription.findOne({
        channel: channelId,
        subscriber: userId
    })

    let subs
    if(!subscribed){
        // subscribe the channel

        const subscribe= await Subscription.create({
            channel: channelId,
            subscriber: userId
        })

        if(!subscribe){
            throw new ApiError(500, "Error while subscribing the channel")
        }

        subs= true
    }
    else{
        // Unscubscribe the channel

        const unsubscribe= await Subscription.deleteOne({
            channel: channelId,
            subscriber: userId
        })

        if(!unsubscribe){
            throw new ApiError(500, "Error while unsubscribing the channel")
        }
        subs= false
    }

    return res.status(200).json(
        new ApiResponse(200, subs, subs ? "Channel subscribed successfully" : "Channel unsubscribed successfully")
    )
})

// Get all subscribers of a channel 200: OK
const getUserChannelSubscribers= asyncHandler(async(req, res)=>{
    const {channelId}= req.params

    if(!channelId || !isValidObjectId(channelId)){
        throw new ApiError(400, "Missing or invallid channel ID")
    }

    const userId= req.user?._id

    const subscribersList= await Subscription.aggregate(
        [
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(channelId)
                }
            },
            {
                $group: {
                    _id: "$channel",
                    subscribersCount: {
                        $sum: 1
                    }
                }
            },
            {
                $project: {
                    subscribersCount: 1,
                    channel: 1
                }
            }
        ]
    )

    const subscribersCount= subscribersList.length > 0 ? subscribersList[0] : 0

    return res.status(200).json(
        new ApiResponse(200, subscribersCount, "Subscribers fetched successfully")
    )
})

// Get all channels subscribed by a user 200: OK
const getSubscribedChannels= asyncHandler(async(req, res)=>{
    const {subscriberId}= req.params

    if(!subscriberId || !isValidObjectId(subscriberId)){
        throw new ApiError(400, "Missing or invalid subsciber Id")
    }

    const userId= req.user?._id

    const totalCount= await Subscription.countDocuments({
        subscriber: new mongoose.Types.ObjectId(subscriberId)
    })

    const subscribedChannels= await Subscription.aggregate(
        [
            {
                $match: {
                    subscriber: new mongoose.Types.ObjectId(subscriberId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "channel",
                    foreignField: "_id",
                    as: "channelDetails",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullname: 1,
                                avatar: 1,
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    channelDetails: {
                        $first: "$channelDetails"
                    }
                }
            },
            {
                $project: {
                    channelDetails: 1
                }
            }
        ]
    )

    if(!subscribedChannels?.length){
        throw new ApiError(404, "No subscribed channels found")
    }

    return res.status(200).json(
        new ApiResponse(200, {totalCount, subscribedChannels}, "Subscribed channels fetched successfully")
    )
})

export{
    toggleSubscription, getSubscribedChannels, getUserChannelSubscribers
}