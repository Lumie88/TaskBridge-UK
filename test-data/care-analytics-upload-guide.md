# Care Analytics Test Upload

Use `care-analytics-demo.csv` to test the free Care analytics dashboard.

## Required CSV columns

- `service_user_name` or `service_user_reference`
- `date` in `YYYY-MM-DD` format
- `metric`
- `value`
- `unit`
- `outcome`
- `notes`

## How matching works

TaskBridge matches each row to a service user in the logged-in care agency by:

1. service-user UUID
2. service-user reference, such as `res_abc123`
3. service-user name

If upload fails with `service user was not found`, replace the first column values with the exact service-user names or references shown in the Care coordinator portal.

## Useful metrics to test

- `falls_risk_score`
- `mobility_score`
- `nutrition_score`
- `hospital_admission_risk`
- `hydration_score`
- `medication_adherence_score`

Higher values are treated as worse for risk-style metrics. Lower values are treated as worse for wellbeing-style metrics such as mobility, nutrition, hydration and independence.
