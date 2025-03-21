import mongoose, {isValidObjectId} from "mongoose";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.models.js";

const addComment= asyncHandler(async(req, res)=>{
    const {videoId}= req.params
    const {content}= req.body

    const userId= req.user?._id

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Missing or Invalid User Id")
    }

    if(!content){
        throw new ApiError(400, "Commen is blank")
    }

    const video= await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    const comment= await Comment.create({
        content,
        video: videoId,
        owner: userId
    })

    if(!comment){
        throw new ApiError(400, "Failed to creating comment")
    }

    return res.status(200).json(
        new ApiResponse(200, comment, "Comment added successfully")
    )
})

const updateComment= asyncHandler(async(req, res)=>{
    const {commentId}= req.params

    if(!commentId || !isValidObjectId(commentId)){
        throw new ApiError(400, "Missing or Invalid comment Id")
    }

    const {content}= req.body
    
    if(!content){
        throw new ApiError(400, "Provide a content for comment")
    }

    const userId= req.user?._id

    const comment= await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404, "Comment not found")
    }

    if(!comment.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to update another's comment")
    }

    const updateComment=  await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )

    if(!updateComment){
        throw new ApiError(400, "Failed to update the comment")
    }

    return res.status(200).json(
        new ApiResponse(200, updateComment, "Comment updated successfully")
    )
})

const deleteComment= asyncHandler(async(req, res)=>{
    const {commentId}= req.params

    if(!commentId || !isValidObjectId(commentId)){
        throw new ApiError(400, "Missing or invalid commenr ID")
    }

    const userId= req.user?._id

    const comment= await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404, "Comment not found")
    }

    if(!comment.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to delete another's comment")
    }

    const deletdComment= await Comment.findByIdAndDelete(commentId)

    if(!deletdComment){
        throw new ApiError(400, "Failed to delete the comment")
    }

    return res.status(200).json(
        new ApiResponse(200, deletdComment, "Comment deletd successfully")
    )
})

const getVideoComments= asyncHandler(async(req, res)=>{
    const {videoId}= req.params

    ConstantSourceNode(page= 1, limit= 10)= req.query

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Missing or invalid video ID")
    }

    const comments= await Comment.aggregate(
        [
            { // match the comments of the video 
                $match: {
                    video: mongoose.Types.ObjectId(videoId)
                }
            },
            { // popULte the user details to it
                $lookup:{
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "createdBy",
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
            { // convert the createdBy array into object
                $addFields: {
                    createdBy: {
                        $first: "$createdBy"
                    }
                }
            },
            {
                $unwind: "createdBy"
            },
            { // Projrct the final output
                content: 1,
                createdBy: 1
            },
            { //pagination
                $skip: (page - 1) * limit
            }
        ]
    )

    if(!comments){
        throw new ApiError(400, "Failed to fetch comments")
    }

    return res.status(200).json(
        new ApiResponse(200, comments, "Comments fetched successfully")
    )
})

export{
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}