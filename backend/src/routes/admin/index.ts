import { Router } from "express";
import adminAuthRoutes from "./auth";
import adminAnalyticsRoutes from "./analytics";
import adminArtistApprovalsRoutes from "./artist-approvals";
import adminArtistsRoutes from "./artists";
import adminContentRoutes from "./content";
import adminFeaturedArtistsRoutes from "./featured-artists";
import adminImageUploadRoutes from "./image-upload";

const router = Router();

router.use("/", adminAuthRoutes);
router.use("/", adminArtistApprovalsRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/artists", adminArtistsRoutes);
router.use("/content", adminContentRoutes);
router.use("/featured-artists", adminFeaturedArtistsRoutes);
router.use("/upload-image", adminImageUploadRoutes);

export default router;
