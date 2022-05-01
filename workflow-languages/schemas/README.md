# ⚠️ Important Note

```diff
- Please do not use these schemas as reference
```

The schemas contained in this directory (and used by the extension) **are not the officially supported schemas for Galaxy workflows** and **must not be used as a reference** for Galaxy Workflows. These are custom-tailored schemas to take advantage of the existing functionality in VSCode around JSON schemas and are **meant for internal use only**.

> The official Galaxy Workflow format `Format 2` schema can be found in https://github.com/galaxyproject/gxformat2

In particular, the `Native Workflow format (.ga)` defined in [native.schema.json](/workflow-languages/schemas/native.schema.json) is considered an internal Galaxy format and is not meant for manual editing. However, the extension tries to provide assistance for experts needing to temporarily maintain this legacy format before migrating to the new `Format 2`.
