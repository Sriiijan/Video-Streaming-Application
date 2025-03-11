import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary= async (localFilePath)=> {
    try{
        if(!localFilePath){
            return null
        }
        // upload the file on cloudinary
        const response= await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfully
        // console.log("File is uploaded on cloudinary: ", response.url)
        fs.unlinkSync(localFilePath)
        return response
    }
    catch(error){
        fs.unlinkSync(localFilePath) // remove the locally save temp file a sthe upload operation got failed
        return null
    }
}

const deleteFromCloudinary= async(cloudUrl)=>{
    try {
        // extract the public ID from the url
        const publicId= cloudUrl.split("/").pop().split(".")[0]
    
        // delete the file using public Id
        const result= await cloudinary.uploader.destroy(publicId)
        
        console.log("Deleted: ", result)
        return result
    } catch (error) {
        console.error("Error deleting file: ", error)
    }
}

const deleteVideoFromCloudinary= async(cloudUrl)=>{
    try {
        // extract the public ID from the url
        const urlParts= cloudUrl.split("/")
        const publicIdWithExtension= urlParts[urlParts.lemgth - 1]
        const publicId= publicIdWithExtension.split(".")[0]

        // delete the file using public Id
        const result= await cloudinary.uploader.destroy(publicId, {
            resource_type: "video"
        })
        
        console.log("Deleted: ", result)
        return result
    } catch (error) {
        console.error("Error deleting file: ", error)
    }
}

export {
    uploadOnCloudinary,
    deleteFromCloudinary,
    deleteVideoFromCloudinary
}