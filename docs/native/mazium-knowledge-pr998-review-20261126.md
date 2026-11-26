# PR #998 knowledge review - 26 November 2026

Reviewed the auctions service delegation, auction-scoped access helper and trade permissions, website live-auction retrieval, and native surface selection, record conversion and marker generation. The service reads current saved seller declarations for authorised auctions, including ended unsold lots returned to Draft. It rejects deleted, withdrawn, rejected and cancelled records and rechecks state during retrieval. This is not an immutable inspection snapshot.

Added a dedicated retrieval topic explaining exact versus approximate markers, per-record evidence, generic reference models, independent inspection distinctions, access restrictions and honest failure states. Existing fee, bidding and payment facts are unchanged. Regenerated the source manifest after this review, with regression coverage for retrieval and truthful wording. Native delivery and physical device acceptance remain pending.
