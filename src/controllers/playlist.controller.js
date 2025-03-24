import mongoose, {isValidObjectId} from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create a new playlist 200: OK
const createPlaylist= asyncHandler(async(req, res)=>{
    const {name, description}= req.body

    if(!name || !description){
        throw new ApiError(400, "Playlist Name and Description are required")
    }

    const userId= req.user?._id

    const existingPlaylist= await Playlist.findOne({
        name,
        owner: userId
    })

    if(existingPlaylist){
        throw new ApiError(400, "A playlist with this name is alreay exist")
    }

    const playlist= await Playlist.create({
        name,
        description,
        owner: userId
    })
    
    if(!playlist){
        throw new ApiError(400, "Error while creating playlist")
    }

    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist created successfully")
    )
})

// Get all playlists of a user 200: OK
const getUserPlaylists= asyncHandler(async(req, res)=>{
    const {userId}= req.params

    if(!userId || !isValidObjectId(userId)){
        throw new ApiError(400, "Missing orr invalid user Id")
    }

    const userPlaylists= await Playlist.aggregate(
        [
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId)
                }
            },
            { // LOOKUP FOR OWNER'S DETAILS
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField:"_id",
                    as: "createdBy",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullName:1, 
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            { // converting the  array to an object
                $addFields: {
                    createdBy: {
                        $first: "$createdBy"
                    }
                }
            },
            {// lookup for videos
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    pipeline: [
                        // further lookup to get the owner details of the video
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
                        }
                    ]
                }    
            },
            { // Final projection
                $project: {
                    videos: 1,
                    creatdeBY: 1,
                    name: 1,
                    description: 1
                }
            }
        ]
    )

    if(!userPlaylists){
        throw new ApiError(400, "No playlist found")
    }

    return res.status(200).json(
        new ApiResponse(200, userPlaylists, "Playlist s fetched successfully")
    )
})

// Get a playlist by its ID 200: OK
const getPlaylistById= asyncHandler(async(req, res)=>{
    const {playlistId}= req.params

    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400, "Missing or invlid playlist Id")
    }

    const playlistById= await Playlist.aggregate(
        [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(playlistId)
                }
            },
            {// lookup for getting owner details
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "createdBy",
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
                    createdBY: {
                        $first: "$createdBy"
                    }
                }
            },
            {// lookup forvideos
                $lookup: {
                    from: "videos",
                    localField: "videos",
                    foreignField: "_id",
                    as: "videos",
                    pipeline: [
                        // further lookup for owners details
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline :[
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
                        // projrcttion at video level
                        {
                            $project: {
                                title: 1,
                                description: 1,
                                thumbnail: 1,
                                owner: 1,
                                duration: 1,
                                views: 1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    videos: 1,
                    createdBy: 1,
                    name: 1,
                    description: 1
                }
            }
        ]
    )

    if(!playlistById){
        throw new ApiError(404, "No playlisy found")
    }

    return res.status(200).json(
        new ApiResponse(200, playlistById, "Playlist fetched successfully")
    )
})

// Add a video to a playlist 200: OK
const addVideoToPlaylist= asyncHandler(async(req, res)=>{
    const {playlistId, videoId}= req.params

    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400, "Missing or invalid playlist Id")
    }

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Missing or invalid video Id")
    }

    const userId= req.user?._id

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(!playlist.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to add video to another's playlist")
    }

    if(playlist.videos.includes(videoId)){
        throw new ApiError(400, "This video already exist in the playlist")
    }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push: {
                videos: videoId
            }
        },
        {new: true}
    )

    if(!updatedPlaylist){
        throw new ApiError(400, "Error while adding video to the playlist")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video added successfully")
    )
})

// Remove a video from a playlist 200: OK
const removeVideoFromPlaylist= asyncHandler(async(req, res)=>{
    const {playlistId, videoId}= req.params

    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400, "Missing or invalid playlist Id")
    }

    if(!videoId || !isValidObjectId(videoId)){
        throw new ApiError(400, "Missing or invalid video Id")
    }

    const userId= req.user?._id

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(!playlist.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to remove video from another's playlist")
    }

    if(!playlist.videos.includes(videoId)){
        throw new ApiError(400, "This video doesn't exist in the playlist")
    }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {new: true}
    )

    if(!updatedPlaylist){
        throw new ApiError(400, "Error while removing video from the playlist")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video removed successfully")
    )
})

// Delete a playlist 200: OK
const deletePlaylist= asyncHandler(async(req, res)=>{
    const {playlistId}= req.params

    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400, "Missing or invalid playlist Id")
    }

    const userId= req.user?._id

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(!playlist.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to delete another's playlist")
    }

    const deletedPlaylist= await Playlist.findByIdAndDelete(playlist._id)

    if(!deletePlaylist){
        throw new ApiError(400, "Error while deleting playlist")
    }

    return res.status(200).json(
    new ApiResponse(200, {}, "Playlist deleted successfully")
    )
})

// Update a playlist 200: OK
const updatePlaylist= asyncHandler(async(req, res)=>{
    const {playlistId}= req.params
    if(!playlistId || !isValidObjectId(playlistId)){
        throw new ApiError(400, "Missing or invalid playlist Id")
    }

    const {name, description}= req.body

    if (!name || !description) {
        throw new ApiError(400, "All the fields are required");
    }

    const userId= req.user?._id

    const playlist= await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(!playlist.owner.equals(userId)){
        throw new ApiError(403, "You are not allowed to update another's playlist")
    }

    const updatedPlaylist= await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name, 
                description
            }
        },
        {new: true}
    )

    if(!updatedPlaylist){
        throw new ApiError(400, "Error while update the playlist")
    
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Update playlist successfully")
    )
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}