import sharp from "sharp";
import { unlink } from "fs/promises";

export const createImage = async (username: string, image: File): Promise<string | null> => {
    let filename = null;

    const create_image = image.size > 0 && image.size <= 5000000;

    if (create_image) {
        filename = username + "-" + Date.now().toString() + ".webp";
        const ab = await image.arrayBuffer();
        await sharp(ab).rotate().resize(300).webp().toFile(`uploads/${filename}`);
    }

    return filename;
};

export const deleteImage = async (filename: string): Promise<void> => {
    try {
        await unlink(`uploads/${filename}`);
    } catch {
        console.warn("Unable to delete file: ", filename);
    }
};

export const tryDeleteImage = async (imageUrl: string): Promise<void> => {
    try {
        new URL(imageUrl);
    } catch {
        await deleteImage(imageUrl);
    }
};
