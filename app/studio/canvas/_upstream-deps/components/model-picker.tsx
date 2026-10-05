"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Cpu } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/app/studio/canvas/_upstream-deps/components/ui/select";
import { useAutoDLWorkflowNames } from "@/app/studio/canvas/_upstream-deps/hooks/use-autodl-workflow";
import { isWorkflowProtocol } from "@/app/studio/canvas/_upstream-deps/lib/model-channel";
import { cn } from "@/app/studio/canvas/_upstream-deps/lib/utils";
import type { WorkflowRef } from "@/app/studio/canvas/_upstream-deps/lib/workflow-channel";
import { catalogModelsByCapability, catalogRouteForModel, filterModelsByCapability, normalizeLocalChannels, useConfigStore, type AiConfig, type ModelCapability } from "@/app/studio/canvas/_upstream-deps/stores/use-config-store";
import { useUserStore } from "@/app/studio/canvas/_upstream-deps/stores/use-user-store";
import type { AiModel } from "@/lib/api/types";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    channelId?: string;
    routeId?: string;
    capability?: ModelCapability;
    onChange: (model: string, channelId?: string, routeId?: string, routeName?: string) => void;
    onRouteChange?: (routeId?: string, routeName?: string) => void;
    workflowRef?: WorkflowRef;
    onWorkflowChange?: (ref?: WorkflowRef) => void;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

type PickerBase = { key: string; channelId?: string; channelName: string; protocol?: string; baseUrl?: string };
type ModelPickerOption = PickerBase & { model: string; modelName?: string; catalogModel?: AiModel };
type WorkflowPickerOption = PickerBase & { model: ""; workflowRef: WorkflowRef; label: string };
type PickerOption = ModelPickerOption | WorkflowPickerOption;

export function ModelPicker(props: ModelPickerProps) {
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const [routeOpen, setRouteOpen] = useState(false);
    const token = useUserStore((state) => state.token);
    const userReady = useUserStore((state) => state.isReady);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const workflowEnabled = Boolean(props.onWorkflowChange && props.capability && props.capability !== "text");
    const catalogModels = useMemo(() => catalogModelsByCapability(props.config, props.capability), [props.capability, props.config]);
    const useRemoteCatalog = props.config.channelMode === "remote" && catalogModels.length > 0;

    const channelOptions = useMemo<PickerOption[]>(() => {
        const channels = props.config.channelMode === "remote"
            ? props.config.publicChannels.map((channel) => ({ id: channel.id, protocol: channel.protocol, name: channel.name || "云端渠道", baseUrl: channel.baseUrl, models: channel.models, modelCapabilities: channel.modelCapabilities, workflows: channel.workflows || [] }))
            : normalizeLocalChannels(props.config).map((channel) => ({ id: channel.id, protocol: channel.protocol, name: channel.name || "本地渠道", baseUrl: channel.baseUrl, models: channel.models, modelCapabilities: channel.modelCapabilities, workflows: channel.workflowSummaries || [] }));

        const catalogOptions: ModelPickerOption[] = useRemoteCatalog
            ? catalogModels.map((model) => ({
                key: `catalog:${model.modality}:${model.id}`,
                channelId: "shadowweave-auto",
                channelName: "影织模型目录",
                protocol: "openai",
                baseUrl: "/api",
                model: model.id,
                modelName: model.name || model.id,
                catalogModel: model,
            }))
            : [];
        const localOptions: ModelPickerOption[] = channels
            .filter((channel) => !isWorkflowProtocol(channel.protocol || ""))
            .flatMap((channel) => filterModelsByCapability(channel.models ?? [], props.capability, channel.protocol || "", channel.modelCapabilities).map((model) => ({
                key: `${channel.id}::${model}`,
                channelId: channel.id,
                channelName: channel.name,
                protocol: channel.protocol,
                baseUrl: channel.baseUrl,
                model,
            })));
        const filtered = useRemoteCatalog ? catalogOptions : localOptions;
        if (!workflowEnabled || !token) return filtered;
        const scope = props.config.channelMode === "remote" ? "system" : "personal";
        const workflows: WorkflowPickerOption[] = channels.flatMap((channel) => isWorkflowProtocol(channel.protocol || "")
            ? channel.workflows.filter((entry) => entry.enabled && entry.capability === props.capability && entry.provider === channel.protocol).map((entry) => {
                const ref: WorkflowRef = { scope, channelId: channel.id || "", kind: entry.kind, workflowId: entry.workflowId };
                return { key: `workflow:${JSON.stringify([ref.scope, ref.channelId, ref.kind, ref.workflowId])}`, channelId: channel.id, channelName: channel.name, protocol: channel.protocol, baseUrl: channel.baseUrl, model: "", workflowRef: ref, label: entry.title || entry.workflowId };
            })
            : []);
        return [...filtered, ...workflows];
    }, [catalogModels, props.capability, props.config, token, useRemoteCatalog, workflowEnabled]);

    const modelLabel = useAutoDLWorkflowNames(channelOptions);
    const workflowRef = props.workflowRef;
    const currentOption = useMemo(() => {
        if (workflowRef && workflowEnabled) return channelOptions.find((item) => "workflowRef" in item && item.key === `workflow:${JSON.stringify([workflowRef.scope, workflowRef.channelId, workflowRef.kind, workflowRef.workflowId])}`);
        if (!props.value) return undefined;
        return channelOptions.find((item) => item.model === props.value && item.channelId === props.channelId) || channelOptions.find((item) => item.model === props.value);
    }, [channelOptions, props.channelId, props.value, workflowEnabled, workflowRef]);
    const current: string = props.workflowRef && workflowEnabled
        ? (currentOption && "label" in currentOption ? String(currentOption.label) : "")
        : props.value || "";
    const currentValue = current && currentOption ? currentOption.key : "";
    const currentChannel = currentOption ? { protocol: currentOption.protocol, baseUrl: currentOption.baseUrl } : undefined;
    const selectedCatalogModel = currentOption && "catalogModel" in currentOption ? currentOption.catalogModel : catalogModels.find((model) => model.id === props.value);
    const selectedRoute = selectedCatalogModel ? catalogRouteForModel(props.config, selectedCatalogModel.id, props.routeId, props.capability) : undefined;
    const routeOptions = selectedCatalogModel?.routes || [];

    useEffect(() => {
        if (props.workflowRef && workflowEnabled) {
            const workflowOptionsReady = props.workflowRef.scope === "system" ? publicSettings !== null : props.config.workflowSyncTouched === true;
            if (token && userReady && workflowOptionsReady && !currentOption && channelOptions.some((item) => !("workflowRef" in item))) props.onWorkflowChange?.(undefined);
            return;
        }
        if (props.value && currentOption?.channelId && !("workflowRef" in currentOption) && props.channelId !== currentOption.channelId) props.onChange(props.value, currentOption.channelId, selectedRoute?.id, selectedRoute?.name);
    }, [channelOptions, currentOption, props.channelId, props.config.workflowSyncTouched, props.onChange, props.onWorkflowChange, props.value, props.workflowRef, publicSettings, selectedRoute, token, userReady, workflowEnabled]);

    useEffect(() => {
        if (!props.onRouteChange || !selectedRoute || selectedRoute.id === props.routeId) return;
        props.onRouteChange(selectedRoute.id, selectedRoute.name);
    }, [props.onRouteChange, props.routeId, selectedRoute]);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) {
                setOpen(false);
                setRouteOpen(false);
            }
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return (
        <div className={cn("flex min-w-0 items-center gap-2", props.fullWidth && "w-full")}>
            <Select
                open={open}
                value={current ? currentValue : ""}
                onOpenChange={(nextOpen) => {
                    if (nextOpen && !channelOptions.length && props.config.channelMode === "local") {
                        props.onMissingConfig?.();
                        return;
                    }
                    if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
                    setOpen(nextOpen);
                }}
                onValueChange={(nextValue) => {
                    const option = channelOptions.find((item) => item.key === nextValue);
                    if (!option) return;
                    if ("workflowRef" in option) {
                        props.onWorkflowChange?.(option.workflowRef);
                        return;
                    }
                    const route = option.catalogModel?.defaultRouteId ? option.catalogModel.routes?.find((item) => item.id === option.catalogModel?.defaultRouteId) : option.catalogModel?.routes?.[0];
                    props.onChange(option.model, option.channelId, route?.id, route?.name);
                    if (props.workflowRef) props.onWorkflowChange?.(undefined);
                }}
            >
                <SelectTrigger
                    className={cn(
                        "canvas-composer-model-picker h-8 w-fit max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors",
                        props.fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
                        "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                        props.className,
                    )}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    title={props.workflowRef && workflowEnabled && !currentOption ? "工作流已停用、未公开或删除，请重新选择" : String(current || props.placeholder || "选择模型")}
                >
                    <ModelIcon model={String(current)} />
                    <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{props.workflowRef && workflowEnabled ? current || "工作流已停用、未公开或删除，请重新选择" : displayModelLabel(currentOption, modelLabel, current, currentChannel) || props.placeholder || "选择模型"}</span>
                </SelectTrigger>
                <SelectContent data-canvas-no-zoom className="z-[1200] w-96 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl" position="popper" align="start" side="bottom" sideOffset={6} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                    {channelOptions.length ? channelOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key} textValue={`${"workflowRef" in option ? option.label : option.modelName || modelLabel(option.model, { protocol: option.protocol, baseUrl: option.baseUrl })} ${option.model} ${option.channelName}`}>
                            <ModelLabel option={option} modelLabel={modelLabel} />
                        </SelectItem>
                    )) : (
                        <SelectItem value="__empty__" disabled>{props.config.channelMode === "remote" ? "暂无可用模型" : "请先到配置里拉取模型列表"}</SelectItem>
                    )}
                </SelectContent>
            </Select>
            {props.onRouteChange && routeOptions.length > 0 ? (
                <Select value={selectedRoute?.id || ""} open={routeOpen} onOpenChange={setRouteOpen} onValueChange={(nextRouteId) => {
                    const route = routeOptions.find((item) => item.id === nextRouteId);
                    props.onRouteChange?.(route?.id, route?.name);
                    setRouteOpen(false);
                }}>
                    <SelectTrigger className={cn("h-8 min-w-24 max-w-44 flex-1 rounded-full border border-input bg-transparent px-3 text-xs font-normal", props.fullWidth && "min-w-28")} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} title={selectedRoute?.name || "选择线路"}>
                        <span className="truncate text-left">{selectedRoute?.name || "选择线路"}</span>
                    </SelectTrigger>
                    <SelectContent data-canvas-no-zoom className="z-[1200] w-72 rounded-xl border border-border/70 bg-popover p-1 shadow-xl" position="popper" align="start" side="bottom" sideOffset={6}>
                        {routeOptions.map((route) => <SelectItem key={route.id} value={route.id} textValue={`${route.name} ${route.description || ""}`}><span className="flex min-w-0 items-center justify-between gap-3"><span className="truncate">{route.name}</span>{route.description ? <span className="shrink-0 text-xs opacity-60">{route.description}</span> : null}</span></SelectItem>)}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    );
}

function displayModelLabel(option: PickerOption | undefined, modelLabel: (model: string, channel?: { protocol?: string; baseUrl?: string } | null) => string, current: string, channel?: { protocol?: string; baseUrl?: string }) {
    if (!option) return modelLabel(current, channel);
    if ("workflowRef" in option) return option.label;
    return option.modelName || modelLabel(option.model, channel) || option.model;
}

function ModelLabel({ option, modelLabel }: { option: PickerOption; modelLabel: (model: string, channel?: { protocol?: string; baseUrl?: string } | null) => string }) {
    if ("workflowRef" in option) return <span className="flex min-w-0 items-center gap-2"><ModelIcon model={option.workflowRef.workflowId} /><span className="truncate">工作流 · {option.label}</span></span>;
    return <span className="flex min-w-0 items-center gap-2"><ModelIcon model={option.model} /><span className="min-w-0 flex-1 truncate" title={option.model}>{option.modelName || modelLabel(option.model, { protocol: option.protocol, baseUrl: option.baseUrl }) || option.model}</span><span className="max-w-32 shrink-0 truncate text-xs opacity-50">{option.catalogModel ? option.catalogModel.id : option.channelName}</span></span>;
}

function ModelIcon({ model }: { model: string }) {
    const icon = resolveModelIcon(model);
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm")) return "/icons/glm.svg";
    return "";
}
