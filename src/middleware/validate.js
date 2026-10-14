const { z } = require("zod");

const submissionSchema = z.object({
  widget_id: z.string().min(1, "widget_id is required"),
  // Honeypot field: if filled by bots, submission is trapped
  _website_hp: z.string().optional(),
  data: z.record(z.any()).refine(
    (obj) => Object.keys(obj).length > 0,
    "Submission data cannot be empty"
  ),
});

function validateSubmission(req, res, next) {
  // Reject oversized payloads (> 50KB)
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > 50 * 1024) {
    return res.status(413).json({
      error: "Payload Too Large",
      message: "Submission payload exceeds maximum allowed size of 50KB",
    });
  }

  const result = submissionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation Error",
      details: result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  req.validatedData = result.data;
  next();
}

module.exports = {
  validateSubmission,
};
