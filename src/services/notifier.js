let forceEmailFailure = false;

function setMockEmailFailure(fail) {
  forceEmailFailure = !!fail;
}

/**
 * Dispatches side-effects (confirmation email / webhook).
 * Rule: Failures must NEVER block the 2xx success of the submission.
 */
async function triggerSideEffects(submission) {
  // Execute asynchronously
  setImmediate(async () => {
    try {
      if (forceEmailFailure) {
        throw new Error("Simulated SMTP timeout / Mailer connection refused");
      }

      console.log(`[SIDE EFFECT] Confirmation email successfully sent for submission ${submission.id} to ${submission.data?.email || "user"}`);
    } catch (err) {
      // Log failure safely without crashing or leaking to client
      console.warn(`[SIDE EFFECT SAFE FAILURE] Background side-effect failed for ${submission.id}: ${err.message}`);
    }
  });
}

module.exports = {
  triggerSideEffects,
  setMockEmailFailure,
};
