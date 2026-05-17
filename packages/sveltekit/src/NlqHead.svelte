<script lang="ts">
type Props = {
  src?: string;
};
let { src = "https://elements.nlqdb.com/v1.js" }: Props = $props();
</script>

<svelte:head>
  <script type="module" {src}></script>
</svelte:head>
