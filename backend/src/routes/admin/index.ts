import { Router } from "express";
import adminAuthRoutes from "./auth";
import adminAnalyticsRoutes from "./analytics";
import adminArtistApprovalsRoutes from "./artist-approvals";
import adminArtistsRoutes from "./artists";
import adminContentRoutes from "./content";

const router = Router();

router.use("/", adminAuthRoutes);
router.use("/", adminArtistApprovalsRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/artists", adminArtistsRoutes);
router.use("/content", adminContentRoutes);

export default router;
