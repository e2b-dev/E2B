SELECT
  deployments.id,
  deployments.created_at,
  deployments.logs,
  deployments.project_id,
  deployments.route_id,
  deployments.state,
  deployments.url,
  deployments.logs_raw,
  deployments.config,
  deployments.enabled,
  deployments.auth,
  deployments.last_finished_prompt,
  deployments.secrets,
  CASE
    WHEN (deployments.secrets IS NULL) THEN NULL :: text
    ELSE CASE
      WHEN ('e3cf22c3-d780-452c-ad91-395c88ee6d6e' IS NULL) THEN NULL :: text
      ELSE convert_from(
        pgsodium.crypto_aead_det_decrypt(
          decode(deployments.secrets, 'base64' :: text),
          convert_to('' :: text, 'utf8' :: name),
          'e3cf22c3-d780-452c-ad91-395c88ee6d6e' :: uuid,
          NULL :: bytea
        ),
        'utf8' :: name
      )
    END
  END AS decrypted_secrets
FROM
  deployments;