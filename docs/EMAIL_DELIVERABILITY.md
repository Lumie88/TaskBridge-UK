# Email Deliverability Notes

Checked domain: `growingfig.com`

Current DNS status:
- MX: Zoho Mail records are present.
- SPF: present as `v=spf1 include:zohomail.eu ~all`.
- DKIM: Zoho DKIM selector `zmail._domainkey.growingfig.com` is present.
- DMARC: missing. `_dmarc.growingfig.com` does not currently resolve.

Known failure reason:
- The earlier message to `oshonubi@growingfig.com` bounced with `550 5.1.1 Invalid email recipients`. That means Zoho rejected the recipient address as invalid or non-existent. It was not an SPF/DKIM/DMARC failure.
- Zoho also rejected `integrations@growingfig.com` and `handyman.support@growingfig.com` as API senders with `Given FromAddress not exists!`.
- The connected Zoho Mail API account reports the mailbox `integration@growingfig.com`, and live API sending from `integration@growingfig.com` succeeds.

Required DNS fix before full scale:

```text
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@growingfig.com; ruf=mailto:postmaster@growingfig.com; adkim=s; aspf=s
```

Safer rollout option:

```text
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:postmaster@growingfig.com; adkim=s; aspf=s
```

Use `p=none` for reporting-only monitoring if you are not ready to quarantine failing mail. Move to `p=quarantine` or `p=reject` after confirming Zoho-sent TaskBridge mail passes alignment.

Go-live checks:
- Send onboarding email to a valid `growingfig.com` mailbox.
- Send onboarding email to Gmail and Outlook test accounts.
- Confirm no bounce from `mailer-daemon@mail.zoho.eu`.
- Confirm SPF, DKIM and DMARC pass in message headers.
- Keep invalid or uncreated recipient addresses out of live demos.
