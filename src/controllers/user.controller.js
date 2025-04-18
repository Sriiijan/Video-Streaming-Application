import  {asyncHandler}  from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// new access and refresh token generate: 200 OK
const generateAccessAndRefreshToken= async(userId)=>{
    try{
        const user= await User.findById(userId)
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()
        
        user.refreshToken= refreshToken
        await user.save({
            validateBeforeSave: false
        })

        return {accessToken, refreshToken}
    }
    catch(error){
        throw new ApiError(500, "something went wrong while generating refrsh ang access token")
    }
}

// new user registration: 200 OK
const registerUser= asyncHandler(async (req, res)=>{
    // get user details from frontend
    // validation- not empty
    // check if user alradey exist: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object- create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const {fullName, email, username, password}= req.body
    console.log("email: ", email)

    if(
        [fullName, email, username, password].some((field)=>field?.trim() === "") // check all fields are blank or not
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser= await User.findOne({ // check if user alradey exist
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exist")
    }

    console.log(req.files)

    let avatarLocalPath;
if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
    avatarLocalPath = req.files.avatar[0].path;
}

    // const coverImageLocalPath= req.files?.coverImage[0]?.path

    let coverImageLocalPath
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath= req.files.coverImage[0].path
    }

    if(!avatarLocalPath){ // check for avatar
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath) // upload avatar to cloudinary
    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user= await User.create({ // create user object in DB
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something wnt wrong while user registration")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

// log in: 200 OK
const loginUser= asyncHandler(async(req, res)=>{
    // req body->data
    // usernaeme or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const {email, username, password}= req.body

    if(!(username || email)){
        throw new ApiError(400, "username or email is required")
    }

    const user= await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "user does not exist")
    }

    const isPasswordValid= await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken}= await generateAccessAndRefreshToken(user._id)

    const loggedInUser= await User.findById(user._id). select("-password -refreshToken")

    const options= {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken, refreshToken
            },
            "user logged in successfully"
        )
    )
})

// log out: 200 OK
const logoutUser= asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this remove the field from the document
            }
        },
        {
            new: true
        }
    )
    const options= {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken").json(
        new ApiResponse(200, {}, "User logged out")
    )
})

// genarate refresh token: 200 OK
const refreshAccessToken= asyncHandler(async(req, res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken= jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user= await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh toke is expiredor used")
        }
    
        const options= {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken}= await generateAccessAndRefreshToken(user._id)
    
        return res.cookie("accessToken", accessToken, options).cookie("refreshToken", newRefreshToken, options).json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }
})

// change passsword: 200 OK
const changeCurrentPassword= asyncHandler(async(req, res)=> {
    const {oldPassword, newPassword}= req.body

    const user= await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (!oldPassword){
        throw new ApiError(404, "Password not found")
    }
    
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "invalid old password")
    }

    user.password= newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200, {}, "password changed successfully"))
})

// get current user:200 OK
const getCurrentUser= asyncHandler(async(req, res)=>{
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

// update account details:200 OK
const updateAccountDetails= asyncHandler(async(req, res)=>{
    const {fullName, email}= req.body

    if(!(fullName || email)){
        throw new ApiError(400, "All fields are required")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new:  true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(new ApiResponse(200, user, "Account details changed successfully"))
    )
})

// update avatar:200 OK
const updateUserAvatar= asyncHandler(async(req,res)=>{
    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    )
    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"))

})

// update cover image:200 OK
const updateUsercoverImage= asyncHandler(async(req,res)=>{
    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover image")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    )
    
    return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"))
})

// to get user profile info:200 OK
const getUserChannelProfile= asyncHandler(async(req, res)=>{
    const {username}= req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }
    console.log("Searching for username:", username);

    const channel= await User.aggregate(
        [
            {
                $match:{
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup:{
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup:{
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields:{
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    channelSubscribedCount:{
                        $size: "$subscribedTo"
                    },
                    isSubscribed:{
                        $cond:{
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project:{
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelSubscribedCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
                }
            }
        ]
    )
    console.log("Searching for username:", channel);


    if(!channel?.length){ // channel doesn't exist
        throw new ApiError(404, "channel doesn't exixt")
    }

    return res.status(200).json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

// to get watch history:200 OK
const getWatchHistory= asyncHandler(async(req, res)=>{
    const user= await User.aggregate(
        [
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "user",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
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
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    )

    return res.status(200).json(
        new ApiResponse(200, user[0].getWatchHistory, "Watch history fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUsercoverImage,
    getUserChannelProfile,
    getWatchHistory
}