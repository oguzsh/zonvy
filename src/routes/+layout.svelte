<script lang="ts">
  import "../app.css";

  let { children } = $props();

  if (navigator.userAgent.includes("Mac")) {
    document.documentElement.dataset.platform = "mac";
  }
</script>

{@render children()}
