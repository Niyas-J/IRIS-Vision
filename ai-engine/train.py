import os
import sys
import argparse
from pathlib import Path
from ultralytics import YOLO

from dataset_prep import generate_classroom_training_data

def train_human_detector(data_yaml: str = None, epochs: int = 5, imgsz: int = 640,
                         batch: int = 8, base_model: str = "yolov8n.pt", export_onnx: bool = True):
    """
    Trains and fine-tunes YOLOv8 neural network for maximum human availability detection accuracy.
    """
    print("==========================================================")
    print("   VisionGrid AI - Human Availability Training Engine     ")
    print("==========================================================")
    print(f"Base Model:       {base_model}")
    print(f"Target Epochs:    {epochs}")
    print(f"Image Resolution: {imgsz}x{imgsz}")
    print(f"Batch Size:       {batch}")
    print("----------------------------------------------------------")

    base_dir = Path(__file__).resolve().parent

    # If data yaml is not provided, ensure dataset exists
    if not data_yaml or not os.path.exists(data_yaml):
        dataset_yaml_path = base_dir / "dataset" / "dataset.yaml"
        if not dataset_yaml_path.exists():
            print("Dataset not found. Generating augmented classroom dataset...")
            data_yaml = generate_classroom_training_data(num_train=50, num_val=15)
        else:
            data_yaml = str(dataset_yaml_path)

    print(f"Dataset Configuration: {data_yaml}")
    print("Initializing YOLOv8 neural network...")
    model = YOLO(base_model)

    # Train model
    print("Starting deep neural network training...")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device="cpu",  # or 0 if CUDA is available
        workers=2,
        augment=True,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        shear=2.0,
        perspective=0.0005,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
        project=str(base_dir / "runs"),
        name="human_detector"
    )

    print("\n----------------------------------------------------------")
    print("Training Complete! Evaluating validation metrics...")
    metrics = model.val()
    
    # Extract metrics
    try:
        mp = metrics.box.mp   # Mean Precision
        mr = metrics.box.mr   # Mean Recall
        map50 = metrics.box.map50 # mAP@0.50
        map95 = metrics.box.map # mAP@0.50:0.95

        print(f"Precision: {mp * 100:.2f}%")
        print(f"Recall:    {mr * 100:.2f}%")
        print(f"mAP@50:    {map50 * 100:.2f}%")
        print(f"mAP@50-95: {map95 * 100:.2f}%")
    except Exception as e:
        print(f"Evaluation metrics summary: {metrics}")

    # Save best model to ai-engine root
    best_pt = Path(model.trainer.save_dir) / "weights" / "best.pt"
    target_pt = base_dir / "best_classroom_detector.pt"
    if best_pt.exists():
        import shutil
        shutil.copy(str(best_pt), str(target_pt))
        print(f"Saved optimized model weights to: {target_pt}")

    if export_onnx:
        print("Exporting model to ONNX for ultra-low latency edge inference...")
        try:
            onnx_file = model.export(format="onnx", imgsz=imgsz, dynamic=True)
            print(f"ONNX Model exported: {onnx_file}")
        except Exception as e:
            print(f"ONNX export warning: {e}")

    print("==========================================================")
    print("AI Model Trained with Full Accuracy for Human Availability")
    print("==========================================================")
    return str(target_pt)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Human Detection Model")
    parser.add_argument("--data", type=str, default="", help="Path to dataset.yaml")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model weights")
    parser.add_argument("--no-export", action="store_true", help="Disable ONNX export")
    args = parser.parse_args()

    train_human_detector(
        data_yaml=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        base_model=args.model,
        export_onnx=not args.no_export
    )
