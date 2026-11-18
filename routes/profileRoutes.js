import { Router } from "express";
import { getProfile, listProfiles } from "../profiles.js";

export function createProfileRouter() {
  const router = Router();

  router.get("/profiles", (req, res) => {
    res.json({
      profiles: listProfiles(),
    });
  });

  router.get("/profiles/:profileKey", (req, res) => {
    const profile = getProfile(req.params.profileKey);
    res.json(profile);
  });

  return router;
}
